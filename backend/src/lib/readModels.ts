export function readModelItems(
  kind: 'doctor' | 'clinic' | 'appointment' | 'token',
  item: Record<string, any>,
) {
  const { pk, sk, ...data } = item;
  if (kind === 'doctor' || kind === 'clinic')
    return [{ ...data, pk: `CATALOG#${kind.toUpperCase()}S`, sk: data.id }];
  if (kind === 'token')
    return [
      {
        ...data,
        pk: `VISITS#CLINIC#${data.clinicId}`,
        sk: `${data.queueDate || data.createdAt.slice(0, 10)}#${data.id}`,
      },
    ];
  return ['patientId', 'doctorId', 'clinicId'].map((field) => ({
    ...data,
    pk: `APPOINTMENTS#${field.replace('Id', '').toUpperCase()}#${data[field]}`,
    sk: `${data.date}#${data.id}`,
  }));
}
