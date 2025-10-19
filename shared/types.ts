/**
 * Core TypeScript types for Courtly
 * All entities are multi-tenant (scoped by orgId)
 * Schema follows exact specification from requirements
 */

import { Timestamp } from 'firebase/firestore';

// ===== Enums & Constants =====

export type Role = 'owner' | 'manager' | 'frontdesk' | 'coach' | 'member' | 'guest';

export type BookingStatus = 
  | 'pending_payment'
  | 'confirmed'
  | 'canceled'
  | 'refunded';

export type BookingSource = 'web' | 'admin' | 'api';

export type CourtSurface = 'hard' | 'clay' | 'grass' | 'carpet' | 'other';

export type PricingModel = 'hourly' | 'fixed' | 'tiered' | 'free';

export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'refund'
  | 'policy_change';

// ===== Helper Types =====

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface HoursOfOperation {
  mon?: { open: string; close: string };
  tue?: { open: string; close: string };
  wed?: { open: string; close: string };
  thu?: { open: string; close: string };
  fri?: { open: string; close: string };
  sat?: { open: string; close: string };
  sun?: { open: string; close: string };
}

export interface OperatingHoursExtended {
  monday?: { open: string; close: string; closed?: boolean };
  tuesday?: { open: string; close: string; closed?: boolean };
  wednesday?: { open: string; close: string; closed?: boolean };
  thursday?: { open: string; close: string; closed?: boolean };
  friday?: { open: string; close: string; closed?: boolean };
  saturday?: { open: string; close: string; closed?: boolean };
  sunday?: { open: string; close: string; closed?: boolean };
}

export interface BookingSettings {
  maxDaysInAdvance?: number;
  minBookingDuration?: number;
  maxBookingDuration?: number;
  slotInterval?: number;
  allowOverlapping?: boolean;
  requireApproval?: boolean;
}

export interface OrgPolicies {
  bookingWindowDays: number;
  publicBookingWindowDays?: number;
  bufferMinutes: number;
  maxAdvanceDays?: number;
  maxBookingsPerMemberPerDay: number;
  cancelPolicy: string;
  allowGuestBookings: boolean;
}

export interface PaymentSettings {
  stripeAccountId: string;
  payoutEnabled: boolean;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
}

export interface StaffMember {
  userId: string;
  role: string;
}

export interface MaintenanceWindow {
  start: Timestamp;
  end: Timestamp;
  reason: string;
}

export interface CourtPolicyOverrides {
  bookingWindowDays?: number;
  bufferMinutes?: number;
  bookingIntervals?: number;
  sunsetCutoffOverride?: string;
}

// ===== Core Entities =====

export interface Org {
  orgId: string;
  name: string;
  shortName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  geoLocation: GeoLocation;
  timezone: string;
  currency: string;
  email: string;
  phone: string;
  website: string;
  logoURL: string;
  bannerURL: string;
  description: string;
  policies: OrgPolicies;
  hours: HoursOfOperation;
  operatingHours?: OperatingHoursExtended; // For court reservation system
  bookingSettings?: BookingSettings; // For court reservation system
  courtCount: number;
  courtsWithLights: number;
  indoorCourts: number;
  outdoorCourts: number;
  hasLights: boolean;
  sunsetCutoffDefault: string;
  bookingIntervals: number;
  pricingModel: PricingModel;
  memberPricePerHour: number;
  guestPricePerHour: number;
  currencySymbol: string;
  paymentSettings: PaymentSettings;
  stripeAccountId: string;
  staff: StaffMember[];
  isActive: boolean;
  isVerified: boolean;
  tags: string[];
  socialLinks: SocialLinks;
  schemaVersion: number;
}

export interface Court {
  courtId: string;
  name: string;
  number: number;
  surface: string;
  indoor: boolean;
  hasLights: boolean;
  openHours?: HoursOfOperation;
  maintenanceWindows: MaintenanceWindow[];
  features: string[];
  notes: string;
  policyOverrides?: CourtPolicyOverrides;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Booking {
  bookingId: string;
  courtId: string;
  start: Timestamp;
  end: Timestamp;
  memberId?: string;
  guestEmail?: string;
  price: number;
  currency: string;
  status: BookingStatus;
  coachId?: string;
  programId?: string;
  policySnapshot: Record<string, any>;
  createdBy: string;
  createdAt: Timestamp;
  notes: string;
  source: BookingSource;
  paymentId?: string;
}

export interface Block {
  blockId: string;
  courtIds: string[];
  start: Timestamp;
  end: Timestamp;
  reason: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface AuditLog {
  logId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId: string;
  changes?: Record<string, { before: any; after: any }>;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

export type UserType = 'member' | 'admin' | 'courtly';

export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoURL?: string | null;
  phone?: string | null;
  organizations: Array<{ orgId: string; role: Role }>;
  defaultOrgId?: string | null;
  userType: UserType; // 'member' | 'admin' | 'courtly'
  isActive: boolean;
  authProvider: 'password' | 'google' | 'manual';
  permissions?: string[];
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  notificationTokens?: string[];
  stripeCustomerId?: string | null;
  joinedAt: Timestamp;
  lastLogin?: Timestamp;
  lastActivityAt?: Timestamp;
  createdBy?: string;
  referralCode?: string | null;
  inviteToken?: string | null;
  deletedAt?: Timestamp | null;
  schemaVersion: number;
}

export interface CustomClaims {
  orgId?: string;
  role?: Role;
  orgs?: string[];
}

export interface CreateBookingRequest {
  courtId: string;
  start: Date;
  end: Date;
  memberId?: string;
  guestEmail?: string;
  coachId?: string;
  programId?: string;
  notes?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  bookingId?: string;
  error?: string;
  errorCode?: string;
}

export interface CancelBookingRequest {
  bookingId: string;
  reason?: string;
}

export interface CancelBookingResponse {
  success: boolean;
  refundAmount?: number;
  error?: string;
}
