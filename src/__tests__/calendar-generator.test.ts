import { describe, it, expect } from 'vitest';
import { generateBookingIcs, getOutlookWebCalendarUrl, getCalendarPackageForRecipient } from '../lib/calendar-generator';

describe('Calendar Generator (.ics and Outlook Web links)', () => {
  const sampleBookingData = {
    bookingId: 'booking-abc-123',
    roomName: 'Falcon',
    roomFloor: 'Floor 2',
    startTime: '2026-07-15T10:00:00+05:30',
    endTime: '2026-07-15T11:00:00+05:30',
    organizer: {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@dhanuka.com',
    },
    attendees: [
      { name: 'Priya Sharma', email: 'priya.sharma@dhanuka.com' },
      { name: 'Amit Patel', email: 'amit.patel@dhanuka.com' },
    ],
    departmentName: 'Finance',
    agenda: 'Q3 Financial Review & Budget Planning',
  };

  it('generates a valid .ics string with correct Asia/Kolkata timezone identifier and participants', () => {
    const ics = generateBookingIcs({
      ...sampleBookingData,
      canViewAgenda: true,
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('TIMEZONE-ID:Asia/Kolkata');
    expect(ics).toContain('X-WR-TIMEZONE:Asia/Kolkata');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('SUMMARY:Q3 Financial Review & Budget Planning — Falcon');
    expect(ics).toContain('LOCATION:Falcon (Floor 2)');
    expect(ics).toContain('ORGANIZER;CN="Rajesh Kumar":mailto:rajesh.kumar@dhanuka.com');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE;CN="Priya Sharma');
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20260715T100000');
    expect(ics).toContain('DTEND;TZID=Asia/Kolkata:20260715T110000');
    expect(ics).toContain('Agenda: Q3 Financial Review & Budget Planning');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('omits agenda from .ics description and title when canViewAgenda is false', () => {
    const ics = generateBookingIcs({
      ...sampleBookingData,
      canViewAgenda: false,
    });

    const unfolded = ics.replace(/\r?\n[ \t]/g, '');
    expect(unfolded).toContain('SUMMARY:Meeting — Falcon');
    expect(unfolded).not.toContain('Agenda: Q3 Financial Review & Budget Planning');
    expect(unfolded).toContain('Organizer: Rajesh Kumar (rajesh.kumar@dhanuka.com)');
    expect(unfolded).toContain('Department: Finance');
  });

  it('generates a cancellation .ics file with METHOD:CANCEL when isCancellation is true', () => {
    const ics = generateBookingIcs({
      ...sampleBookingData,
      canViewAgenda: true,
      isCancellation: true,
      cancellationReason: 'Emergency conflict',
    });

    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('SUMMARY:Cancelled: Q3 Financial Review & Budget Planning — Falcon');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('Cancellation Reason: Emergency conflict');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=DECLINED;RSVP=FALSE;CN="Priya');
  });

  it('generates standard Outlook Web compose deep-link with valid UTC start/end times and URL encoding', () => {
    const url = getOutlookWebCalendarUrl({
      title: 'Q3 Financial Review & Budget Planning — Falcon',
      startTime: sampleBookingData.startTime,
      endTime: sampleBookingData.endTime,
      location: 'Falcon (Floor 2)',
      description: 'Organizer: Rajesh Kumar\nAgenda: Q3 Financial Review & Budget Planning',
    });

    expect(url).toContain('https://outlook.office.com/calendar/0/deeplink/compose?');
    expect(url).toContain('path=%2Fcalendar%2Faction%2Fcompose');
    expect(url).toContain('rru=addevent');
    expect(url).toContain('startdt=2026-07-15T04%3A30%3A00.000Z'); // 10:00+05:30 in UTC
    expect(url).toContain('enddt=2026-07-15T05%3A30%3A00.000Z'); // 11:00+05:30 in UTC
    expect(url).toContain('subject=Q3+Financial+Review+%26+Budget+Planning+%E2%80%94+Falcon');
    expect(url).toContain('location=Falcon+%28Floor+2%29');
  });

  it('getCalendarPackageForRecipient bundles icsContent, filename, and outlookWebUrl enforcing agenda rules', () => {
    const pkgPermitted = getCalendarPackageForRecipient({
      ...sampleBookingData,
      canViewAgenda: true,
    });

    expect(pkgPermitted.filename).toBe('invite.ics');
    expect(pkgPermitted.method).toBe('REQUEST');
    expect(pkgPermitted.title).toBe('Q3 Financial Review & Budget Planning — Falcon');
    expect(pkgPermitted.icsContent).toContain('METHOD:REQUEST');
    expect(pkgPermitted.outlookWebUrl).toContain('subject=Q3+Financial+Review+%26+Budget+Planning+%E2%80%94+Falcon');

    const pkgHidden = getCalendarPackageForRecipient({
      ...sampleBookingData,
      canViewAgenda: false,
    });

    expect(pkgHidden.filename).toBe('invite.ics');
    expect(pkgHidden.title).toBe('Meeting — Falcon');
    expect(pkgHidden.icsContent).not.toContain('Q3 Financial Review');
    expect(pkgHidden.outlookWebUrl).not.toContain('Q3+Financial+Review');
  });
});
