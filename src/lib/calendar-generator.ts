import ical, { ICalCalendarMethod, ICalEventStatus, ICalAttendeeRole, ICalAttendeeStatus } from 'ical-generator';

export interface CalendarEventData {
  bookingId: string;
  roomName: string;
  roomFloor?: string;
  startTime: string | number;
  endTime: string | number;
  organizer: {
    name: string;
    email: string;
  };
  attendees?: Array<{
    name: string;
    email: string;
  }>;
  departmentName?: string;
  agenda?: string;
  canViewAgenda?: boolean;
  isCancellation?: boolean;
  cancellationReason?: string;
  sequence?: number;
}

/**
 * Generates a standard .ics iCalendar file content string using ical-generator.
 * Ensures strict Asia/Kolkata timezone adherence and respects agenda visibility rules.
 */
export function generateBookingIcs(data: CalendarEventData): string {
  const calendar = ical({
    name: 'Dhanuka Meeting Rooms',
    timezone: 'Asia/Kolkata',
  });

  calendar.method(data.isCancellation ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.REQUEST);

  const location = `${data.roomName}${data.roomFloor ? ` (${data.roomFloor})` : ''}`;

  const baseTitle = data.canViewAgenda && data.agenda && data.agenda !== 'General'
    ? `${data.agenda} — ${data.roomName}`
    : `Meeting — ${data.roomName}`;
  const summary = data.isCancellation ? `Cancelled: ${baseTitle}` : baseTitle;

  const descLines: string[] = [
    `Organizer: ${data.organizer.name} (${data.organizer.email})`,
    `Department: ${data.departmentName || 'General'}`,
  ];

  if (data.isCancellation) {
    descLines.push(`Status: CANCELLED`);
    if (data.cancellationReason) {
      descLines.push(`Cancellation Reason: ${data.cancellationReason}`);
    }
  } else if (data.canViewAgenda && data.agenda) {
    descLines.push(`Agenda: ${data.agenda}`);
  }

  if (data.attendees && data.attendees.length > 0) {
    descLines.push('', 'Attendees:');
    for (const att of data.attendees) {
      descLines.push(`- ${att.name} (${att.email})`);
    }
  }

  const description = descLines.join('\n');

  const startMs = typeof data.startTime === 'number' ? data.startTime : new Date(data.startTime).getTime();
  const endMs = typeof data.endTime === 'number' ? data.endTime : new Date(data.endTime).getTime();

  const event = calendar.createEvent({
    start: new Date(startMs),
    end: new Date(endMs),
    timezone: 'Asia/Kolkata',
    summary,
    description,
    location,
    id: `${data.bookingId}@dhanuka.com`,
    sequence: data.sequence !== undefined ? data.sequence : (data.isCancellation ? 1 : 0),
    organizer: {
      name: data.organizer.name,
      email: data.organizer.email,
    },
  });

  if (data.isCancellation) {
    event.status(ICalEventStatus.CANCELLED);
  }

  // Add organizer as CHAIR participant
  event.createAttendee({
    name: data.organizer.name,
    email: data.organizer.email,
    role: ICalAttendeeRole.CHAIR,
    status: data.isCancellation ? ICalAttendeeStatus.DECLINED : ICalAttendeeStatus.ACCEPTED,
    rsvp: !data.isCancellation,
  });

  // Add invitees as required participants
  if (data.attendees) {
    for (const att of data.attendees) {
      if (att.email.toLowerCase() !== data.organizer.email.toLowerCase()) {
        event.createAttendee({
          name: att.name,
          email: att.email,
          role: ICalAttendeeRole.REQ,
          status: data.isCancellation ? ICalAttendeeStatus.DECLINED : ICalAttendeeStatus.ACCEPTED,
          rsvp: !data.isCancellation,
        });
      }
    }
  }

  return calendar.toString();
}

/**
 * Generates Microsoft's standard Outlook Web Calendar deep-link URL.
 * Pre-fills start/end times in ISO UTC format so Outlook Web converts them cleanly to the user's local timezone.
 */
export function getOutlookWebCalendarUrl({
  title,
  startTime,
  endTime,
  location,
  description,
}: {
  title: string;
  startTime: string | number;
  endTime: string | number;
  location: string;
  description: string;
}): string {
  const startMs = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
  const endMs = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();

  const startdt = new Date(startMs).toISOString();
  const enddt = new Date(endMs).toISOString();

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    startdt,
    enddt,
    subject: title,
    location,
    body: description,
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export interface RecipientCalendarOptions extends CalendarEventData {
  canViewAgenda: boolean;
}

/**
 * Generates both the .ics content string and the Outlook Web deep-link for a specific recipient,
 * strictly enforcing agenda visibility rules.
 */
export function getCalendarPackageForRecipient(options: RecipientCalendarOptions): {
  icsContent: string;
  filename: string;
  outlookWebUrl: string;
  title: string;
  location: string;
  description: string;
  method: string;
} {
  const icsContent = generateBookingIcs(options);
  const filename = options.isCancellation ? 'cancel.ics' : 'invite.ics';
  const method = options.isCancellation ? 'CANCEL' : 'REQUEST';

  const location = `${options.roomName}${options.roomFloor ? ` (${options.roomFloor})` : ''}`;
  const baseTitle = options.canViewAgenda && options.agenda && options.agenda !== 'General'
    ? `${options.agenda} — ${options.roomName}`
    : `Meeting — ${options.roomName}`;
  const title = options.isCancellation ? `Cancelled: ${baseTitle}` : baseTitle;

  const descLines: string[] = [
    `Organizer: ${options.organizer.name} (${options.organizer.email})`,
    `Department: ${options.departmentName || 'General'}`,
  ];
  if (options.isCancellation && options.cancellationReason) {
    descLines.push(`Cancellation Reason: ${options.cancellationReason}`);
  } else if (options.canViewAgenda && options.agenda) {
    descLines.push(`Agenda: ${options.agenda}`);
  }
  if (options.attendees && options.attendees.length > 0) {
    descLines.push('', 'Attendees:');
    for (const att of options.attendees) {
      descLines.push(`- ${att.name} (${att.email})`);
    }
  }
  const description = descLines.join('\n');

  const outlookWebUrl = getOutlookWebCalendarUrl({
    title,
    startTime: options.startTime,
    endTime: options.endTime,
    location,
    description,
  });

  return {
    icsContent,
    filename,
    outlookWebUrl,
    title,
    location,
    description,
    method,
  };
}
