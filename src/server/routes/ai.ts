import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { db } from '../../db/index.ts';
import {
  academicResources,
  announcements,
  events,
  opportunities,
  campusLocations,
} from '../../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import { ensureSeeded } from '../seed.ts';

const router = Router();

function detectProvider(): { configured: boolean; provider: 'gemini' | 'openai' | 'none' } {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
    return { configured: true, provider: 'gemini' };
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && openaiKey !== 'MY_OPENAI_API_KEY') {
    return { configured: true, provider: 'openai' };
  }
  return { configured: false, provider: 'none' };
}

router.get('/status', (_req, res) => {
  res.json(detectProvider());
});

router.post('/chat', requireAuth, async (req, res) => {
  try {
    await ensureSeeded();
    const schema = z.object({
      question: z.string().trim().min(2).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid question.' });
    }

    const question = parsed.data.question;
    const pattern = `%${question.split(/\s+/).filter((w) => w.length > 2)[0] || question}%`;

    // Retrieve strictly public/approved platform records — never expose user PII!
    const [matchedResources, matchedAnnouncements, matchedEvents, matchedOpps, matchedLocations] =
      await Promise.all([
        db
          .select({
            id: academicResources.id,
            title: academicResources.title,
            unitCode: academicResources.unitCode,
            unitName: academicResources.unitName,
            category: academicResources.category,
          })
          .from(academicResources)
          .where(
            and(
              eq(academicResources.approvalStatus, 'APPROVED'),
              eq(academicResources.isRestricted, false),
              isNull(academicResources.deletedAt),
              or(
                ilike(academicResources.title, pattern),
                ilike(academicResources.unitCode, pattern),
                ilike(academicResources.unitName, pattern)
              )
            )
          )
          .limit(4),
        db
          .select({
            id: announcements.id,
            title: announcements.title,
            scope: announcements.scope,
            body: announcements.body,
          })
          .from(announcements)
          .where(
            and(
              eq(announcements.approvalStatus, 'APPROVED'),
              isNull(announcements.deletedAt)
            )
          )
          .orderBy(desc(announcements.createdAt))
          .limit(3),
        db
          .select({
            id: events.id,
            title: events.title,
            location: events.location,
            startAt: events.startAt,
          })
          .from(events)
          .where(eq(events.approvalStatus, 'APPROVED'))
          .limit(3),
        db
          .select({
            id: opportunities.id,
            title: opportunities.title,
            category: opportunities.category,
            deadline: opportunities.deadline,
          })
          .from(opportunities)
          .where(eq(opportunities.approvalStatus, 'APPROVED'))
          .limit(3),
        db
          .select({
            id: campusLocations.id,
            name: campusLocations.name,
            category: campusLocations.category,
            buildingCode: campusLocations.buildingCode,
            openingHours: campusLocations.openingHours,
          })
          .from(campusLocations)
          .limit(6),
      ]);

    const platformContext = {
      verifiedPlatformRecords: {
        academicResources: matchedResources,
        announcements: matchedAnnouncements,
        events: matchedEvents,
        opportunities: matchedOpps,
        campusDirectory: matchedLocations,
      },
    };

    const providerStatus = detectProvider();
    if (!providerStatus.configured) {
      return res.json({
        configured: false,
        provider: 'none',
        reply:
          'TTU AI is ready once a GEMINI_API_KEY or OPENAI_API_KEY environment variable is configured on the server. All other TTU HUB services remain fully available.',
        sources: platformContext.verifiedPlatformRecords,
      });
    }

    const systemInstruction = `You are TTU AI, the student assistant inside TTU HUB for Taita Taveta University students.
Rules:
1. Never invent official university policies, exam rules, fee structures, or unverified campus coordinates.
2. Clearly distinguish between "Platform Records" (from the provided JSON context) and "General Academic Guidance".
3. Never expose or speculate about private user information.
4. Keep answers concise, clear, and helpful, directing students to exact TTU HUB sections (Ed Vault, Announcements, Events, Opportunities, Campus Directory) when relevant.

Available Platform Records JSON:
${JSON.stringify(platformContext.verifiedPlatformRecords)}`;

    let reply = '';
    if (providerStatus.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: question,
        config: {
          systemInstruction,
        },
      });
      reply = result.text || 'Unable to generate a response right now.';
    } else {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const result = await client.responses.create({
        model: 'gpt-5-mini',
        instructions: systemInstruction,
        input: question,
      });
      reply = result.output_text || 'Unable to generate a response right now.';
    }

    res.json({
      configured: true,
      provider: providerStatus.provider,
      reply,
      sources: platformContext.verifiedPlatformRecords,
    });
  } catch (err) {
    console.error('TTU AI chat error:', err);
    res.status(500).json({
      error: 'TTU AI encountered an error processing your request. Please try again.',
    });
  }
});

export default router;
