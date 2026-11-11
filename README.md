# Automated-Event-Space-Management-System
Event scheduling and logistics system for a cultural center, built on Google Calendar, Google Sheets and Apps Script. Syncs events into monthly schedule sheets, logs changes, sends reports and includes a web app with CRUD and filters.

Event scheduling and logistics system for a cultural venue, built entirely on
Google Workspace (Calendar, Sheets, Gmail, Apps Script).

## Features
- Periodic sync from Google Calendar (configurable interval)
- Automatic classification of each event by **space** and **activity type**
  using normalized keyword matching (accent/case/plural insensitive),
  with optional AI fallback for ambiguous cases
- Monthly sheets (JANUARY-DECEMBER) with a color-coded daily layout:
  one column per space, setup rows one hour before each event,
  and a "pending" column for unclassified events
- Change tracking: new / modified / deleted events stored in a raw database
- Schedule conflict (overlap) detection per space
- Pending sheet for events missing a space or type
- HTML email reports after each sync and for custom date ranges
- Gmail parser that extracts technical requirements (chairs, tables,
  projector, internet, power...) and links them to events
- Web app: calendar, list, search, pending, change log, legend and settings views

## Project structure
| File | Purpose |
|---|---|
| Config.gs | Settings, colors, spaces, sheet names |
| Utilidades.gs | Shared helpers (text normalization, dates, logging) |
| CalendarService.gs | Reads events via the Calendar API |
| Clasificador.gs | Space/type classification and overlap detection |
| BaseDatos.gs | Raw events sheet and change detection |
| Programacion.gs | Monthly sheet generation and formatting |
| Reportes.gs | Email reports |
| EmailParser.gs | Technical requirements extraction from Gmail |
| WebApp.gs | Web app backend |
| Main.gs | Orchestrator, system initialization and triggers |
| index.html / estilos.html / scripts.html | Web app frontend |

## Setup
1. Create a Google Sheet and open Extensions > Apps Script.
2. Add each file to the project.
3. Enable the **Google Calendar API** (v3) advanced service.
4. Set `CALENDAR_ID` and `EMAIL_REPORTES` in `Config.gs`.
5. Run `inicializarSistema()` once and grant the requested permissions.
6. Deploy as a web app (Deploy > New deployment > Web app).

## Roadmap
- [ ] Manual reassignment of pending events from the web app
- [ ] Extract technical requirements from emails using AI
- [ ] Full CRUD from the web app
