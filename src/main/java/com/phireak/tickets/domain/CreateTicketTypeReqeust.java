package com.phireak.tickets.domain;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateTicketTypeReqeust {
    private String name;
    private Double price;
    private String description;
    private Integer totalAvailable;
    private List<CreateTicketTypeReqeust> ticketTypes = new ArrayList<>();
}
