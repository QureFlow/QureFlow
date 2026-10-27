SELECT d.name, s.name AS specialty, d.consultationFee AS fee
FROM doctors d JOIN specialties s ON s.id=d.specialtyId
WHERE s.name='Gynecology' AND d.status='active'
ORDER BY d.consultationFee,d.name;