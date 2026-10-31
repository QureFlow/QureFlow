// Illustrative department imagery, separate from the actual doctor directory.
// Clinics name departments freely ("Pediatrics & Child Care", "Ophthalmology (Eye)"), so a
// specialty is matched to its department by keyword rather than by exact name.
const departments: [string, RegExp][] = [
  ['general-medicine', /general medicine|internal medicine|family medicine/],
  ['dentistry', /dent|oral/],
  ['endocrinology', /endocrin|diabet/],
  ['pulmonology', /pulmo|lung|respirat|chest/],
  ['pediatrics', /pediatr|paediatr|child/],
  ['cardiology', /cardi|heart/],
  ['dermatology', /dermat|skin/],
  ['orthopedics', /ortho|bone|joint/],
  ['gynecology', /gyn|obstet|women/],
  ['ophthalmology', /ophthal|eye/],
  ['ent', /\b(ent|ear|nose|throat)\b/],
  ['neurology', /neuro/],
];

/** Department key of a specialty name, or null when no department photo matches it. */
export const specialtyDepartment = (name: string) => {
  const text = name.trim().toLowerCase();
  return departments.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
};

const photoPositions: Record<string, string> = {
  pediatrics: '38% center',
  orthopedics: '35% center',
  gynecology: '35% center',
  ophthalmology: '58% center',
  ent: '40% center',
  neurology: '80% center',
};

export const specialtyPhotography = (name: string) => {
  const slug = specialtyDepartment(name) ?? 'general-medicine';
  return {
    src: `/images/specialties/${slug}.webp`,
    position: photoPositions[slug] ?? 'center',
  };
};
