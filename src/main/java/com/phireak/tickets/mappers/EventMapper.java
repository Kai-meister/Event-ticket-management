package com.phireak.tickets.mappers;

import com.phireak.tickets.domain.CreateEventRequest;
import com.phireak.tickets.domain.CreateTicketTypeReqeust;
import com.phireak.tickets.domain.Event;
import com.phireak.tickets.domain.dtos.CreateEventResponseDto;
import com.phireak.tickets.domain.dtos.CreateTicketTypeRequestDto;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface EventMapper {
    CreateTicketTypeReqeust fromDto(CreateTicketTypeRequestDto dto);

    CreateEventRequest fromDto(CreateEventResponseDto dto);

    CreateEventResponseDto toDto(Event event);
}
