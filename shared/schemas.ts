/**
 * Zod validation schemas for Courtly
 * These schemas are shared between client and server
 * Schema follows exact specification from requirements
 */

import { z } from 'zod';

// ===== Enums =====

export const RoleSchema = z.enum(['owner', 'manager', 'frontdesk', 'coach', 'member', 'guest']);

export const BookingStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'canceled',
  'refunded',
]);

export const BookingSourceSchema = z.enum(['web', 'admin', 'api']);

export const CourtSurfaceSchema = z.enum(['hard', 'clay', 'grass', 'carpet', 'other']);

export const PricingModelSchema = z.enum(['hourly', 'fixed', 'tiered', 'free']);

export const AuditActionSchema = z.enum([
  'create',
  'update',
  'delete',
  'approve',
  'cancel',
  'refund',
  'policy_change',
]);

// ===== Helper Schemas =====

export const GeoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const HoursOfOperationSchema = z.object({
  mon: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  tue: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  wed: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  thu: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  fri: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  sat: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  sun: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
});

export const OrgPoliciesSchema = z.object({
  bookingWindowDays: z.number().int().positive(),
  publicBookingWindowDays: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0),
  maxAdvanceDays: z.number().int().positive().optional(),
  maxBookingsPerMemberPerDay: z.number().int().positive(),
  cancelPolicy: z.string(),
  allowGuestBookings: z.boolean(),
});

export const PaymentSettingsSchema = z.object({
  stripeAccountId: z.string(),
  payoutEnabled: z.boolean(),
});

export const SocialLinksSchema = z.object({
  facebook: z.string().url().optional(),
  instagram: z.string().url().optional(),
  twitter: z.string().url().optional(),
  linkedin: z.string().url().optional(),
});

export const StaffMemberSchema = z.object({
  userId: z.string(),
  role: z.string(),
});

export const MaintenanceWindowSchema = z.object({
  start: z.any(), // Timestamp
  end: z.any(), // Timestamp
  reason: z.string(),
});

export const CourtPolicyOverridesSchema = z.object({
  bookingWindowDays: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  bookingIntervals: z.number().int().positive().optional(),
  sunsetCutoffOverride: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// ===== Core Entity Schemas =====

export const OrgSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1),
  shortName: z.string().min(1),
  createdAt: z.any(), // Timestamp
  updatedAt: z.any(), // Timestamp
  createdBy: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  postalCode: z.string(),
  geoLocation: GeoLocationSchema,
  timezone: z.string(),
  currency: z.string().length(3),
  email: z.string().email(),
  phone: z.string(),
  website: z.string().url(),
  logoURL: z.string().url(),
  bannerURL: z.string().url(),
  description: z.string(),
  policies: OrgPoliciesSchema,
  hours: HoursOfOperationSchema,
  courtCount: z.number().int().min(0),
  courtsWithLights: z.number().int().min(0),
  indoorCourts: z.number().int().min(0),
  outdoorCourts: z.number().int().min(0),
  hasLights: z.boolean(),
  sunsetCutoffDefault: z.string().regex(/^\d{2}:\d{2}$/),
  bookingIntervals: z.number().int().positive(),
  pricingModel: PricingModelSchema,
  memberPricePerHour: z.number().min(0),
  guestPricePerHour: z.number().min(0),
  currencySymbol: z.string(),
  paymentSettings: PaymentSettingsSchema,
  stripeAccountId: z.string(),
  staff: z.array(StaffMemberSchema),
  isActive: z.boolean(),
  isVerified: z.boolean(),
  tags: z.array(z.string()),
  socialLinks: SocialLinksSchema,
  schemaVersion: z.number().int(),
});

export const CourtSchema = z.object({
  courtId: z.string(),
  name: z.string().min(1),
  number: z.number().int().positive(),
  surface: z.string(),
  indoor: z.boolean(),
  hasLights: z.boolean(),
  openHours: HoursOfOperationSchema.optional(),
  maintenanceWindows: z.array(MaintenanceWindowSchema),
  features: z.array(z.string()),
  notes: z.string(),
  policyOverrides: CourtPolicyOverridesSchema.optional(),
  isActive: z.boolean(),
  createdAt: z.any(), // Timestamp
  updatedAt: z.any(), // Timestamp
});

export const BookingSchema = z.object({
  bookingId: z.string(),
  courtId: z.string(),
  start: z.any(), // Timestamp
  end: z.any(), // Timestamp
  memberId: z.string().optional(),
  guestEmail: z.string().email().optional(),
  price: z.number().int().min(0),
  currency: z.string().length(3),
  status: BookingStatusSchema,
  coachId: z.string().optional(),
  programId: z.string().optional(),
  policySnapshot: z.record(z.any()),
  createdBy: z.string(),
  createdAt: z.any(), // Timestamp
  notes: z.string(),
  source: BookingSourceSchema,
  paymentId: z.string().optional(),
});

export const BlockSchema = z.object({
  blockId: z.string(),
  courtIds: z.array(z.string()).min(1),
  start: z.any(), // Timestamp
  end: z.any(), // Timestamp
  reason: z.string().min(1),
  createdBy: z.string(),
  createdAt: z.any(), // Timestamp
});

export const AuditLogSchema = z.object({
  logId: z.string(),
  action: AuditActionSchema,
  entityType: z.string(),
  entityId: z.string(),
  userId: z.string(),
  changes: z.record(z.object({ before: z.any(), after: z.any() })).optional(),
  timestamp: z.any(), // Timestamp
  metadata: z.record(z.any()).optional(),
});

// ===== Request/Response Schemas =====

export const CreateBookingRequestSchema = z.object({
  courtId: z.string(),
  start: z.date(),
  end: z.date(),
  memberId: z.string().optional(),
  guestEmail: z.string().email().optional(),
  coachId: z.string().optional(),
  programId: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateBookingResponseSchema = z.object({
  success: z.boolean(),
  bookingId: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
});

export const CancelBookingRequestSchema = z.object({
  bookingId: z.string(),
  reason: z.string().optional(),
});

export const CancelBookingResponseSchema = z.object({
  success: z.boolean(),
  refundAmount: z.number().optional(),
  error: z.string().optional(),
});
