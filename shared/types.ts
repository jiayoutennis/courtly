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

export interface SubscriptionInfo {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  lastPaymentFailed?: Timestamp;
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
  stripeCustomerId?: string;
  subscription?: SubscriptionInfo;
  
  // Membership settings
  membershipEnabled?: boolean; // Whether club offers memberships
  membershipTiers?: MembershipTiersMap; // Map of membership tiers by tier name (monthly, annual, day_pass)
  membershipAutoRenew?: boolean; // Default auto-renew setting
  requireMembershipForBooking?: boolean; // Whether users must have active membership to book
  
  // Account balance settings
  accountBalanceSettings?: AccountBalanceSettings; // Account balance configuration for this club
  
  // Platform fee (Courtly's revenue)
  platformFeePercent?: number; // Percentage fee charged by platform (e.g., 5 = 5%)
  
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
  clubMemberships?: Record<string, MembershipTier>; // Map of clubId -> membership tier for quick lookup
  
  // Account balance per club (in cents to avoid floating point issues)
  accountBalances?: Record<string, number>; // Map of clubId -> balance in cents (can be negative for owed amounts)
  
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

// ===== Membership Types =====

export type MembershipTier = 'monthly' | 'annual' | 'day_pass';

// Tier-specific booking rules and privileges
export interface TierPrivileges {
  // Booking privileges
  maxDaysInAdvance: number;           // How far ahead they can book (e.g., 14 days for monthly, 30 for annual)
  maxBookingsPerDay: number;          // Max bookings per day (e.g., 2 for day_pass, 4 for monthly, unlimited for annual)
  maxBookingDuration: number;         // Max hours per booking (e.g., 1 for day_pass, 2 for monthly, 3 for annual)
  minBookingDuration: number;         // Min hours per booking (default 1)
  
  // Payment settings for bookings
  freeBookingsPerMonth: number;       // Number of free bookings included per month (0 = pay per booking)
  bookingPricePerHour: number;        // Price per hour for bookings beyond free quota (in cents)
  useAccountBalance: boolean;         // Whether to charge bookings to account balance or require immediate payment
  requireImmediatePayment: boolean;   // If true, requires Stripe checkout; if false, charges to account balance
  
  // Court access
  allowPrimeTimeBooking: boolean;     // Can book peak hours (5-9pm)
  allowWeekendBooking: boolean;       // Can book weekends
  priorityBooking: boolean;           // Get priority over lower tiers
  
  // Cancellation
  cancellationWindowHours: number;    // How many hours before they can cancel (e.g., 24 for monthly, 2 for annual)
  allowFreeCancellation: boolean;     // Can cancel without penalty
  
  // Guest privileges
  allowGuests: boolean;               // Can bring guests
  maxGuestsPerBooking: number;        // Max guests allowed (0 = no guests)
  
  // Other benefits
  discountPercentage: number;         // Discount on court fees (0-100)
  accessToMemberEvents: boolean;      // Access to member-only events
  accessToLessons: boolean;           // Can book lessons
  lessonDiscount: number;             // Discount on lessons (0-100)
}

// Lightweight membership tier config stored in org document (map structure)
export interface MembershipTierConfig {
  stripeProductId: string;
  stripePriceId: string;
  isActive: boolean;
  privileges?: TierPrivileges;        // Tier-specific rules and benefits
}

// Map of membership tiers - easier lookups by tier name
export type MembershipTiersMap = Partial<Record<MembershipTier, MembershipTierConfig>>;

export interface MembershipPlan {
  id: string;
  name: string;
  tier: MembershipTier;
  price: number;
  currency: string;
  stripePriceId: string;
  stripeProductId: string;
  features: string[];
  description: string;
  isActive: boolean;
  members?: string[]; // Array of user IDs who have this membership tier
}

export interface MemberMembership {
  membershipId: string;
  userId: string;
  orgId: string;
  plan: MembershipPlan;
  status: 'active' | 'expired' | 'canceled';
  startDate: Timestamp;
  endDate: Timestamp;
  stripeSubscriptionId?: string;
  stripeCustomerId: string;
  paymentId: string;
  autoRenew: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Payment Types =====

export type PaymentType = 'booking' | 'membership' | 'subscription';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  paymentId: string;
  userId: string;
  orgId: string;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  metadata: Record<string, any>; // Store booking ID, membership ID, etc.
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// ===== Account Balance Types =====

export type BalanceTransactionType = 
  | 'booking_charge'      // Charged for a booking
  | 'booking_refund'      // Refund for canceled booking
  | 'credit_added'        // Credit added to account (top-up)
  | 'credit_bonus'        // Bonus credit (promotion, referral, etc.)
  | 'membership_credit'   // Credit from membership benefits
  | 'payment_received'    // Payment received from member
  | 'adjustment'          // Manual adjustment by admin
  | 'expired'             // Credit expired (if applicable)
  ;

export interface BalanceTransaction {
  transactionId: string;
  userId: string;
  orgId: string;
  type: BalanceTransactionType;
  amount: number;              // Amount in cents (positive = credit, negative = charge)
  balanceAfter: number;        // Balance after this transaction in cents
  currency: string;
  description: string;
  relatedBookingId?: string;   // If related to a booking
  relatedPaymentId?: string;   // If related to a Stripe payment
  stripePaymentIntentId?: string;
  createdBy: string;           // User or system who created this transaction
  createdAt: Timestamp;
  metadata?: Record<string, any>;
}

// Credit package for purchasing credits in bulk
export interface CreditPackage {
  id: string;
  name: string;                        // e.g., "Small", "Medium", "Large"
  amount: number;                      // Credit amount in cents
  price: number;                       // Price to pay in cents
  bonusPercentage: number;             // Bonus percentage (e.g., 10 = 10% extra credits)
  stripePriceId?: string;              // Stripe price ID for this package
  isActive: boolean;
}

// Account balance settings per club
export interface AccountBalanceSettings {
  enabled: boolean;                    // Whether account balance feature is enabled
  allowNegativeBalance: boolean;       // Can members book with insufficient balance (charge later)
  maxNegativeBalance: number;          // Max negative balance allowed in cents (if negative balance enabled)
  lowBalanceThreshold: number;         // Threshold to warn users in cents
  autoTopUpEnabled: boolean;           // Allow automatic top-up when balance is low
  autoTopUpAmount: number;             // Amount to auto top-up in cents
  autoTopUpThreshold: number;          // Balance threshold to trigger auto top-up in cents
  creditExpirationDays: number;        // Days until unused credits expire (0 = never expire)
  allowCreditPurchase: boolean;        // Can members buy credits upfront
  creditPackages?: CreditPackage[];   // Predefined credit packages for purchase
}
