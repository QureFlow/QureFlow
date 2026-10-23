# DBMS variant interaction contract

- Preserve patient/staff roles, clinic boundaries and existing list/detail/booking routes.
- Exception requested for teaching demonstrations: only the synthetic default administrator in the local MySQL entry point can view/manage all demo clinics. The server derives this capability from its environment and authenticated database account; browser state never grants it. Other staff and production/AWS entry points retain clinic isolation.
- All-clinic queues use the shared Select control with doctor, clinic and waiting count. Clinic settings and insights require an explicit facility selection; stale results must not replace a newer selection. Existing toast, API, form and navigation components remain the canonical owners.
- Doctor specialty, location, language, availability and sort changes reset to page 1 and request SQL-backed results.
- Appointment search, doctor, status and date filters reset to page 1 and use SQL counts and pagination.
- Debounce text/filter requests; discard stale responses on newer input or unmount.
- Show loading feedback and hide outdated rows while a replacement query is pending. Keep entered filters after errors.
- Disable pagination while pending or at its boundary. Empty results do not fabricate doctors or visits.
- Queue calls remain emergency priority then token sequence among eligible arrivals. Complete/skip the current consultation before another call.
- Booking, cancellation and queue transitions use database transactions and surface conflicts; success is displayed only after the API accepts the mutation.
- Display clinic times in Asia/Kolkata; SQL timestamps are stored in UTC.
- Preserve labels, keyboard controls, narrow-screen navigation and local table scrolling.
