
import { supabase } from "@/integrations/supabase/client";

export interface GoogleEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

export const googleCalendarService = {
  async createEvent(calendarId: string, event: GoogleEvent, accessToken: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('google-calendar-create', {
      body: { calendarId, event, accessToken }
    });

    if (error) throw error;
    return data.eventId;
  },

  async updateEvent(
    calendarId: string, 
    eventId: string, 
    event: Partial<GoogleEvent>, 
    accessToken: string
  ): Promise<void> {
    const { error } = await supabase.functions.invoke('google-calendar-update', {
      body: { calendarId, eventId, event, accessToken }
    });

    if (error) throw error;
  },

  async deleteEvent(calendarId: string, eventId: string, accessToken: string): Promise<void> {
    const { error } = await supabase.functions.invoke('google-calendar-delete', {
      body: { calendarId, eventId, accessToken }
    });

    if (error) throw error;
  },

  async getEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    accessToken: string
  ): Promise<GoogleEvent[]> {
    const { data, error } = await supabase.functions.invoke('google-calendar-events', {
      body: { calendarId, timeMin, timeMax, accessToken }
    });

    if (error) throw error;
    return data.events || [];
  }
};
