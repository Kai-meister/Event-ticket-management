package com.phireak.tickets.services;

import com.phireak.tickets.domain.CreateEventRequest;
import com.phireak.tickets.domain.Event;

import java.util.UUID;

public interface EventService {
    Event createEvent(UUID organizerId , CreateEventRequest event);

}
