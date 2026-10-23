# Interaction contract

- Preserve patient/staff roles, clinic boundaries and existing list/detail/booking routes.
- Only the synthetic default administrator of the local DynamoDB demo can view and manage all demo clinics. The server derives this from its environment and the authenticated account; browser state never grants it. Every other account keeps clinic isolation.
- All-clinic queues use the shared Select control with doctor, clinic and waiting count. Clinic settings and insights require an explicit clinic selection; stale results must not replace a newer selection.
- Doctor specialty, location, language, availability and sort changes reset to page 1 and request server-filtered results.
- Appointment search, doctor, status and date filters reset to page 1 and use server counts and pagination.
- Debounce text/filter requests; discard stale responses on newer input or unmount.
- Show loading feedback and hide outdated rows while a replacement query is pending. Keep entered filters after errors.
- Disable pagination while pending or at its boundary. Empty results never fabricate doctors or visits.
- Queue calls remain emergency priority, then token sequence, among eligible arrivals. Complete or skip the current consultation before another call.
- Booking, cancellation and queue transitions are DynamoDB transactions; conflicts are surfaced, and success is shown only after the API accepts the change.
- Waiting-time estimates show a range, never a promise, and never influence clinical priority.
- Display clinic times in Asia/Kolkata; timestamps are stored in UTC.
- Preserve labels, keyboard controls, narrow-screen navigation and local table scrolling.
