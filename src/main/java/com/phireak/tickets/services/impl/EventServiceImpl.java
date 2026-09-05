package com.phireak.tickets.services.impl;

import com.phireak.tickets.domain.CreateEventRequest;
import com.phireak.tickets.domain.Event;
import com.phireak.tickets.domain.User;
import com.phireak.tickets.repositories.UserRepository;
import com.phireak.tickets.services.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventServiceImpl implements EventService {

    private final UserRepository userRepository;


    @Override
    public Event createEvent(UUID organizerId, CreateEventRequest event) {
        User organizer = userRepository.findById(organizerId)
                .orElseThrow(()-> new UsernameNotFoundException(String.format("User with ID '%s' not found ",organizerId))
                );
        Event eventToCreate = new Event();

        eventToCreate.setName((event.getName()));
        eventToCreate.setStart(event.getStart());
        eventToCreate.setEnd(event.getEnd());
        eventToCreate.setVenue(event.getVenue());
        eventToCreate.setSalesStart(event.getSalesStart());
        eventToCreate.setSalesEnd(event.getSalesEnd());
        eventToCreate.setStatus(event.getStatus());
        eventToCreate.setOrganizer(event.getOrganizer());
        return null;
    }
}
