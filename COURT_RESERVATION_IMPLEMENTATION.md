# Court Reservation System - Implementation Summary

## Overview
Created a comprehensive court reservation system for club members at `/club/[clubId]/reserve-court/page.tsx`.

## Features Implemented

### 1. **Dynamic Court Display**
- Fetches courts from club's Firestore document (`orgs/{clubId}`)
- Displays court details: name, type (Hard/Clay/Grass), indoor/outdoor status
- Automatically adjusts grid to show all available courts
- Falls back to default 4 courts if none configured

### 2. **Club-Specific Operating Hours**
- Reads `operatingHours` from club document with day-specific settings:
  ```typescript
  operatingHours: {
    monday: { open: "06:00", close: "22:00", closed: false },
    tuesday: { open: "06:00", close: "22:00", closed: false },
    // ... for each day of week
  }
  ```
- Dynamically generates time slots based on open/close times
- Shows "Closed" message for non-operating days
- Displays hours information at top of schedule

### 3. **Booking Constraints**
- Reads `bookingSettings` from club document:
  ```typescript
  bookingSettings: {
    maxDaysInAdvance: 14,      // How far ahead users can book
    minBookingDuration: 1,      // Minimum hours per booking
    maxBookingDuration: 3,      // Maximum hours per booking
    slotInterval: 60            // Time interval (30 or 60 minutes)
  }
  ```
- Prevents booking beyond maximum advance period
- Enforces duration limits in booking modal
- Supports 30-minute or 60-minute time slots

### 4. **Visual Schedule Grid**
- Color-coded booking blocks:
  - **Green**: Bookings by other members
  - **Blue**: User's own bookings
  - **Gray**: Available slots (click to book)
- Green header with yellow text (matching design)
- Yellow borders between cells
- Hover effects on available slots
- Multi-hour bookings span vertically

### 5. **Interactive Booking Modal**
- Click any available time slot to open booking form
- Select court, date (read-only), start time (read-only), and duration
- Duration dropdown respects min/max settings
- Confirmation button creates booking in Firestore
- Success/error messages with auto-dismiss

### 6. **Date Navigation**
- Previous Day / Today / Next Day buttons
- Shows full date with day of week
- Displays operating hours for selected day
- Disables navigation beyond booking window

### 7. **Real-time Updates**
- Fetches bookings when date changes
- Prevents double-booking of time slots
- Shows current booking status

### 8. **Database Structure**

#### Bookings Collection
```typescript
bookings: {
  clubId: string,
  courtId: string,
  date: string,           // "YYYY-MM-DD"
  startTime: string,      // "HH:MM"
  endTime: string,        // "HH:MM"
  userId: string,
  userName: string,
  userEmail: string,
  createdAt: timestamp,
  status: string          // "confirmed"
}
```

#### Club Document Fields
```typescript
orgs/{clubId}: {
  name: string,
  courts: [
    {
      id: string,
      name: string,
      courtType: string,
      isIndoor: boolean
    }
  ],
  operatingHours: {
    monday: { open: string, close: string, closed?: boolean },
    // ... for each day
  },
  bookingSettings: {
    maxDaysInAdvance: number,
    minBookingDuration: number,
    maxBookingDuration: number,
    slotInterval: number
  }
}
```

## Navigation Updates

### 1. **Club Page** (`/club/[clubId]/page.tsx`)
- Added prominent "Reserve a Court" button for members
- Shows at top of club page with green color scheme
- Only visible to club members

### 2. **Dashboard** (`/dashboard/page.tsx`)
- Added "Reserve Court" link in Quick Actions sidebar
- Dynamically links to user's club reservation page
- Separate "View Schedule" link for read-only viewing

## File Locations

- **Main Page**: `/src/app/club/[clubId]/reserve-court/page.tsx`
- **Old Schedule Page**: `/src/app/court-schedule/page.tsx` (kept for reference)
- **Club Page Updated**: `/src/app/club/[clubId]/page.tsx`
- **Dashboard Updated**: `/src/app/dashboard/page.tsx`

## User Experience

1. **Member Flow**:
   - Login → Dashboard → Click "Reserve Court"
   - Or: Browse to Club Page → Click "Reserve a Court"
   - View schedule grid with available times
   - Click available slot → Fill booking modal → Confirm
   - See booking appear in blue on schedule

2. **Visual Feedback**:
   - Loading spinner during data fetch
   - Success message on successful booking
   - Error messages for booking conflicts
   - Disabled navigation for dates outside booking window
   - Hover effects on clickable elements

## Default Values (if not in database)

- **Operating Hours**: 6 AM - 10 PM weekdays, 8 AM - 8 PM weekends
- **Max Advance Booking**: 14 days
- **Booking Duration**: 1-3 hours
- **Time Slots**: 60 minutes
- **Default Courts**: 4 courts (Hard, Outdoor)

## Next Steps / Enhancements

1. **My Bookings Page**: View and manage user's own bookings
2. **Cancel Booking**: Allow users to cancel their reservations
3. **Recurring Bookings**: Book same time slot for multiple weeks
4. **Booking Conflicts**: More sophisticated conflict detection
5. **Email Notifications**: Send confirmation emails
6. **Payment Integration**: Add fees for prime time slots
7. **Guest Bookings**: Allow members to add guest names
8. **Weather Integration**: Show forecast for outdoor courts
9. **Court Maintenance**: Mark courts as unavailable
10. **Booking History**: Track past reservations

## Security Notes

- User must be authenticated to access reservation page
- User must be member of club to make bookings
- Firestore rules should restrict booking creation to club members
- Consider adding rate limiting to prevent booking abuse
