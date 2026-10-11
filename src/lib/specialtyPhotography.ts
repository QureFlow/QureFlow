// Illustrative department imagery, separate from the actual doctor directory.
const specialtyPhotos: Record<string, string> = {
  'general medicine': 'general-medicine',
  dentistry: 'dentistry',
  endocrinology: 'endocrinology',
  pulmonology: 'pulmonology',
  pediatrics: 'pediatrics',
  cardiology: 'cardiology',
  dermatology: 'dermatology',
  orthopedics: 'orthopedics',
  gynecology: 'gynecology',
  ophthalmology: 'ophthalmology',
  ent: 'ent',
  neurology: 'neurology',
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
  const slug = specialtyPhotos[name.trim().toLowerCase()] ?? 'general-medicine';
  return {
    src: `/images/specialties/${slug}.webp`,
    position: photoPositions[slug] ?? 'center',
  };
};
