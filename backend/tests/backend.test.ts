import { authService } from '../src/services/authService.js';
import { queueService } from '../src/services/queueService.js';
import { dynamoDbRepo } from '../src/repositories/dynamoDbRepo.js';
import { appointmentService } from '../src/services/appointmentService.js';

async function runTests() {
  console.log('\n========================================');
  console.log('RUNNING QUREFLOW BACKEND INTEGRATION TESTS');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  };

  try {
    // ------------------------------------------------------------------------
    // Test 1: Doctor Retrieval from DynamoDB
    // ------------------------------------------------------------------------
    console.log('Test Suite 1: Doctor and Clinic Retrieval');
    const doctors = await dynamoDbRepo.getDoctors();
    assert(doctors.length >= 10, `Retrieved ${doctors.length} doctors from DynamoDB`);
    const doc1 = await dynamoDbRepo.getDoctorById('doc-1');
    assert(doc1 !== null && doc1.name === 'Dr. Ananya Sharma', 'Retrieved doc-1 (Dr. Ananya Sharma)');

    const clinics = await dynamoDbRepo.getClinics();
    assert(clinics.length >= 3, `Retrieved ${clinics.length} clinics from DynamoDB`);

    // ------------------------------------------------------------------------
    // Test 2: Authentication (Login & Registration)
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 2: Authentication');
    const adminSession = await authService.login('admin@bolpurhealth.org', 'AdminPass123!');
    assert(adminSession.user.role === 'admin', 'Admin logged in successfully with correct role');
    assert(Boolean(adminSession.token), 'Admin received signed JWT token');

    const testPhone = `99900${Math.floor(10000 + Math.random() * 90000)}`;
    const testPatientSession = await authService.registerPatient({
      name: 'Integration Test Patient',
      phone: testPhone,
      email: `test.${testPhone}@example.com`,
      gender: 'Female',
      password: 'TestPassword123!',
    });
    assert(testPatientSession.user.role === 'patient', 'New patient registered successfully');
    assert(testPatientSession.user.phone === testPhone, 'Registered phone matches');

    // Test duplicate registration rejection
    let duplicateRejected = false;
    try {
      await authService.registerPatient({
        name: 'Duplicate Patient',
        phone: testPhone,
        email: `dup.${testPhone}@example.com`,
      });
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'Duplicate registration with same phone properly rejected');

    // ------------------------------------------------------------------------
    // Test 3: Concurrency-Safe Queue Joins & Atomic Token Generation
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 3: Queue Management & Concurrency');
    const testDate = `test-${Date.now()}`;
    const p1 = await queueService.joinQueue({
      doctorId: 'doc-1',
      patientId: `pat-test-1-${Date.now()}`,
      patientName: 'Normal Patient 1',
      patientPhone: '9990000001',
      priority: 'normal',
      dateStr: testDate,
    });
    assert(p1.tokenNumber.startsWith('A-'), `Token 1 generated with prefix A (${p1.tokenNumber})`);

    const p2 = await queueService.joinQueue({
      doctorId: 'doc-1',
      patientId: `pat-test-2-${Date.now()}`,
      patientName: 'Normal Patient 2',
      patientPhone: '9990000002',
      priority: 'normal',
      dateStr: testDate,
    });
    assert(p2.tokenNumber !== p1.tokenNumber, `Token numbers are unique: ${p1.tokenNumber} vs ${p2.tokenNumber}`);

    // Test duplicate active queue entry prevention for same patient
    let duplicateQueueRejected = false;
    try {
      await queueService.joinQueue({
        doctorId: 'doc-1',
        patientId: p1.patientId,
        patientName: 'Same Patient Again',
        patientPhone: '9990000001',
        priority: 'normal',
        dateStr: testDate,
      });
    } catch {
      duplicateQueueRejected = true;
    }
    assert(duplicateQueueRejected, 'Patient joining queue twice in active state properly rejected');

    // ------------------------------------------------------------------------
    // Test 4: Priority / Emergency Triage Ordering
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 4: Priority & Emergency Triage');
    // Normal patient joined earlier (p2), now emergency patient joins
    const emergencyPat = await queueService.joinQueue({
      doctorId: 'doc-1',
      patientId: `pat-test-emg-${Date.now()}`,
      patientName: 'Emergency Triage Patient',
      patientPhone: '9990000999',
      priority: 'emergency',
      dateStr: testDate,
    });
    assert(emergencyPat.priority === 'emergency', 'Emergency patient registered');

    // Doctor calls next patient: emergency patient should be served before normal patients!
    const calledToken = await queueService.callNextPatient('doc-1', testDate);
    assert(
      calledToken !== null && calledToken.id === emergencyPat.id,
      `Emergency patient (${calledToken?.tokenNumber}) prioritized ahead of earlier normal queue entries`
    );

    // ------------------------------------------------------------------------
    // Test 5: Queue State Progression (Serve, Complete, Skip)
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 5: Doctor Queue Progression');
    if (calledToken) {
      await queueService.markPatientServed(calledToken.id);
      const afterServedStatus = await queueService.getDoctorQueue('doc-1', testDate);
      const servedItem = afterServedStatus.tokens.find((t) => t.id === calledToken.id);
      assert(servedItem?.status === 'completed', 'Patient status transitioned to completed');
    }

    // Call next normal patient
    const nextNormal = await queueService.callNextPatient('doc-1', testDate);
    assert(nextNormal !== null, `Doctor called next patient: ${nextNormal?.tokenNumber}`);

    if (nextNormal) {
      await queueService.skipPatient(nextNormal.id);
      const afterSkipStatus = await queueService.getDoctorQueue('doc-1', testDate);
      const skippedItem = afterSkipStatus.tokens.find((t) => t.id === nextNormal.id);
      assert(skippedItem?.status === 'skipped', 'Patient status transitioned to skipped');
    }

    // ------------------------------------------------------------------------
    // Test 6: Estimated Wait Time & Position Calculation
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 6: Patient Waiting Status & Estimation');
    const waitingPat = await queueService.getPatientActiveStatus(p2.patientId!);
    assert(waitingPat !== null, 'Retrieved active patient queue status');
    assert(typeof waitingPat?.estimatedWaitMinutes === 'number', `Estimated wait calculated: ${waitingPat?.estimatedWaitMinutes} mins`);
    assert(typeof waitingPat?.patientsAhead === 'number', `Patients ahead calculated: ${waitingPat?.patientsAhead}`);

    // ------------------------------------------------------------------------
    // Test 7: Appointment Booking with Automatic Token Allocation
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 7: Appointments');
    const aptResult = await appointmentService.createAppointment({
      patientId: testPatientSession.user.id,
      patientName: testPatientSession.user.name,
      patientPhone: testPatientSession.user.phone,
      doctorId: 'doc-2',
      date: new Date().toISOString().split('T')[0],
      time: '11:00 AM',
      notes: 'Routine pediatric checkup',
    });
    assert(Boolean(aptResult.appointment.id), 'Appointment created successfully');
    assert(aptResult.token.tokenNumber.startsWith('B-'), `Token allocated with prefix B (${aptResult.token.tokenNumber})`);

    // Clean up test appointments
    await appointmentService.cancelAppointment(aptResult.appointment.id, 'Test cleanup');
    const cancelledApt = await dynamoDbRepo.getAppointmentById(aptResult.appointment.id);
    assert(cancelledApt?.status === 'cancelled', 'Appointment successfully cancelled');

    // ------------------------------------------------------------------------
    // Test 8: Slot Availability, Formula Calculation & "Slot Full" Threshold
    // Formula: tactive * pactive + (p - 1) * tavg + buffer
    // ------------------------------------------------------------------------
    console.log('\nTest Suite 8: Slot Waiting Time Formula & Slot Full Enforcement');
    const slotTestDate = `2099-01-${Math.floor(10 + Math.random() * 18)}`;
    const slotTestDoctor = 'doc-1'; // tavg = 10, slotDuration = 30, buffer = 2

    // 8a. Initial slot check (0 bookings)
    let slots = await appointmentService.getDoctorSlotAvailability(slotTestDoctor, slotTestDate);
    const initialSlot10 = slots.find((s) => s.time === '10:00 AM');
    assert(initialSlot10?.available === true, '10:00 AM slot is initially available');
    assert(initialSlot10?.patientsAhead === 0, '10:00 AM has 0 patients ahead initially');
    assert(initialSlot10?.estimatedWaitMinutes === 0, '10:00 AM has 0 min estimated wait initially');

    // 8b. Book 1st patient: p = 0 at booking time
    const apt1 = await appointmentService.createAppointment({
      patientId: `pat-slot-1-${Date.now()}`,
      patientName: 'Slot Patient 1',
      patientPhone: '9991110001',
      doctorId: slotTestDoctor,
      date: slotTestDate,
      time: '10:00 AM',
    });

    // Verify after 1 booking: next patient sees p = 1 ahead, wait = 10*1 + (1-1)*10 + 2 = 12 mins
    slots = await appointmentService.getDoctorSlotAvailability(slotTestDoctor, slotTestDate);
    const slot10After1 = slots.find((s) => s.time === '10:00 AM');
    assert(slot10After1?.patientsAhead === 1, '10:00 AM shows 1 patient ahead');
    assert(slot10After1?.estimatedWaitMinutes === 12, `Estimated wait for 2nd patient is 12m (tactive*pactive + (p-1)*tavg + buffer): actual ${slot10After1?.estimatedWaitMinutes}m`);
    assert(slot10After1?.available === true && !slot10After1?.isFull, '10:00 AM is still available after 1 booking (12m <= 30m slot duration)');

    // 8c. Book 2nd patient: next patient sees p = 2 ahead, wait = 10*1 + (2-1)*10 + 2 = 22 mins
    const apt2 = await appointmentService.createAppointment({
      patientId: `pat-slot-2-${Date.now()}`,
      patientName: 'Slot Patient 2',
      patientPhone: '9991110002',
      doctorId: slotTestDoctor,
      date: slotTestDate,
      time: '10:00 AM',
    });

    slots = await appointmentService.getDoctorSlotAvailability(slotTestDoctor, slotTestDate);
    const slot10After2 = slots.find((s) => s.time === '10:00 AM');
    assert(slot10After2?.patientsAhead === 2, '10:00 AM shows 2 patients ahead');
    assert(slot10After2?.estimatedWaitMinutes === 22, `Estimated wait for 3rd patient is 22m: actual ${slot10After2?.estimatedWaitMinutes}m`);
    assert(slot10After2?.available === true && !slot10After2?.isFull, '10:00 AM is still available after 2 bookings (22m <= 30m slot duration)');

    // 8d. Book 3rd patient: next patient sees p = 3 ahead, wait = 10*1 + (3-1)*10 + 2 = 32 mins (> 30m)
    const apt3 = await appointmentService.createAppointment({
      patientId: `pat-slot-3-${Date.now()}`,
      patientName: 'Slot Patient 3',
      patientPhone: '9991110003',
      doctorId: slotTestDoctor,
      date: slotTestDate,
      time: '10:00 AM',
    });

    // Verify slot is now FULL
    slots = await appointmentService.getDoctorSlotAvailability(slotTestDoctor, slotTestDate);
    const slot10After3 = slots.find((s) => s.time === '10:00 AM');
    assert(slot10After3?.patientsAhead === 3, '10:00 AM shows 3 patients ahead');
    assert(slot10After3?.estimatedWaitMinutes === 32, `Estimated wait calculated as 32m: actual ${slot10After3?.estimatedWaitMinutes}m`);
    assert(slot10After3?.isFull === true, 'Slot marked as FULL because wait time (32m) exceeds 30m slot duration');
    assert(slot10After3?.available === false, 'Slot unavailable for booking when full');
    assert(slot10After3?.statusText === 'Slot Full', 'Slot statusText is "Slot Full"');

    // 8e. Attempting to book a 4th patient for full slot is rejected
    let slotFullRejected = false;
    try {
      await appointmentService.createAppointment({
        patientId: `pat-slot-4-${Date.now()}`,
        patientName: 'Slot Patient 4',
        patientPhone: '9991110004',
        doctorId: slotTestDoctor,
        date: slotTestDate,
        time: '10:00 AM',
      });
    } catch (err: any) {
      slotFullRejected = true;
      assert(err.message.includes('full'), `Booking rejected with error message: "${err.message}"`);
    }
    assert(slotFullRejected, 'Booking into full slot properly rejected by backend validation');

    // Clean up test slot appointments
    await appointmentService.cancelAppointment(apt1.appointment.id, 'Test cleanup');
    await appointmentService.cancelAppointment(apt2.appointment.id, 'Test cleanup');
    await appointmentService.cancelAppointment(apt3.appointment.id, 'Test cleanup');

    // After cancellation, slot reopens
    slots = await appointmentService.getDoctorSlotAvailability(slotTestDoctor, slotTestDate);
    const slot10AfterCancel = slots.find((s) => s.time === '10:00 AM');
    assert(slot10AfterCancel?.isFull === false && slot10AfterCancel?.available === true, '10:00 AM slot reopens after cancellations');

  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n========================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
