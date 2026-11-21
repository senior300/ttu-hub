export type UserRole =
  | 'STUDENT'
  | 'LECTURER'
  | 'ADMIN'
  | 'SUPERADMIN'
  | 'ORGANIZATION_LEADER';

export interface UserProfile {
  id: number;
  publicId: string;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  requestedRole: string | null;
  accountStatus: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED';
  profileCompleted: boolean;
  registrationNumber: string | null;
  staffId: string | null;
  school: string | null;
  department: string | null;
  course: string | null;
  yearOfStudy: number | null;
  currentSemester: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface AcademicResource {
  id: number;
  publicId: string;
  title: string;
  description: string;
  category: 'NOTES' | 'PAST_PAPER' | 'REVISION' | 'ASSIGNMENT' | 'DOCUMENT';
  school: string;
  department: string;
  course: string;
  unitCode: string;
  unitName: string;
  academicYear: string;
  semester: string;
  fileName: string;
  fileMime: string;
  fileSizeBytes: number;
  uploadedById: number;
  uploaderName?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  isRestricted: boolean;
  downloadCount: number;
  isBookmarked?: boolean;
  createdAt: string;
}

export interface TimetableEntry {
  id: number;
  courseName: string;
  unitCode: string;
  unitName: string;
  entryType: 'CLASS' | 'EXAM';
  dayOrDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  lecturerName: string | null;
  semester: string;
}

export interface AssignmentItem {
  id: number;
  publicId: string;
  unitCode: string;
  unitName: string;
  title: string;
  instructions: string;
  dueDate: string;
  maxScore: number;
  lecturerId: number;
  lecturerName?: string | null;
  createdAt: string;
}

export interface AnnouncementItem {
  id: number;
  publicId: string;
  title: string;
  body: string;
  scope: 'UNIVERSITY' | 'SCHOOL' | 'DEPARTMENT' | 'STUDENT' | 'ORGANIZATION';
  targetName: string | null;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  authorId: number;
  authorName?: string | null;
  organizationId: number | null;
  createdAt: string;
}

export interface OrganizationItem {
  id: number;
  publicId: string;
  name: string;
  category: string;
  description: string;
  mission: string | null;
  logoUrl: string | null;
  leaderId: number;
  leaderName?: string | null;
  approvalStatus: string;
  contactEmail: string | null;
  meetingSchedule: string | null;
  memberCount: number;
  myMembershipStatus: string | null;
}

export interface EventItem {
  id: number;
  publicId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  posterUrl: string | null;
  organizerId: number;
  organizerName?: string | null;
  organizationId: number | null;
  registeredCount: number;
  isRegistered: boolean;
}

export interface OpportunityItem {
  id: number;
  publicId: string;
  title: string;
  organizationName: string;
  category: string;
  description: string;
  eligibility: string;
  location: string;
  deadline: string;
  externalUrl: string | null;
  approvalStatus: string;
  isSaved?: boolean;
}

export interface MarketplaceItem {
  id: number;
  publicId: string;
  title: string;
  description: string;
  category: string;
  priceKes: number;
  condition: string;
  imageUrl: string | null;
  sellerId: number;
  sellerName?: string | null;
  sellerDepartment?: string | null;
  availabilityStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  createdAt: string;
}

export interface AccommodationItem {
  id: number;
  publicId: string;
  name: string;
  providerType: 'UNIVERSITY_HOSTEL' | 'PRIVATE_ACCOMMODATION';
  description: string;
  location: string;
  pricePerSemesterKes: number;
  roomsAvailable: number;
  availabilityVerified: boolean;
  amenities: string;
  imageUrl: string | null;
  contactInfo: string;
  ownerId: number;
}

export interface LostFoundItem {
  id: number;
  publicId: string;
  reportType: 'LOST' | 'FOUND';
  title: string;
  description: string;
  location: string;
  dateReported: string;
  imageUrl: string | null;
  reporterId: number;
  reporterName?: string | null;
  status: 'OPEN' | 'CLAIMED' | 'RECOVERED';
  createdAt: string;
}

export interface CampusLocationItem {
  id: number;
  publicId: string;
  name: string;
  category: string;
  description: string;
  buildingCode: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinatesVerified: boolean;
  openingHours: string | null;
  contactEmail: string | null;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  linkPath: string | null;
  isRead: boolean;
  createdAt: string;
}
