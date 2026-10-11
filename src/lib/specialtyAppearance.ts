import { Activity, Baby, Bone, Brain, Ear, Eye, Flower2, HeartPulse, Smile, Stethoscope, Wind } from 'lucide-react';

// Shared visual identity for specialties in the directory and doctor profiles.
export const specialtyAppearance = (name: string) => {
  switch (name.toLowerCase()) {
    case 'cardiology': return { Icon: HeartPulse, tone: 'coral', description: 'Heart & cardiovascular care' };
    case 'orthopedics': return { Icon: Bone, tone: 'gold', description: 'Bone, joint & mobility care' };
    case 'neurology': return { Icon: Brain, tone: 'lavender', description: 'Brain & nervous system' };
    case 'pediatrics': return { Icon: Baby, tone: 'mint', description: 'Care for children' };
    case 'gynecology': return { Icon: Flower2, tone: 'rose', description: 'Women’s health' };
    case 'ophthalmology': return { Icon: Eye, tone: 'blue', description: 'Eye health & vision' };
    case 'ent': return { Icon: Ear, tone: 'gold', description: 'Ear, nose & throat' };
    case 'dermatology': return { Icon: Flower2, tone: 'rose', description: 'Skin health' };
    case 'dentistry': return { Icon: Smile, tone: 'blue', description: 'Dental & oral care' };
    case 'pulmonology': return { Icon: Wind, tone: 'mint', description: 'Lung & respiratory care' };
    case 'endocrinology': return { Icon: Activity, tone: 'lavender', description: 'Hormonal & metabolic health' };
    default: return { Icon: Stethoscope, tone: 'blue', description: 'Everyday & preventive care' };
  }
};
