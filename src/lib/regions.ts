/** Seychelles region/district reference data used by the Region and
 * District dropdowns on the Servicing Request wizard and customer forms. */
export const REGION_DISTRICTS: Record<string, string[]> = {
  Mahe: [
    'Anse Etoile',
    'Au Cap',
    'Baie Lazare',
    'Baie Sainte Anne',
    'Bel Air',
    'Bel Ombre',
    'Cascade',
    'English River',
    'Glacis',
    'Grand Anse Mahe',
    'Les Mamelles',
    'Mont Buxton',
    'Mont Fleuri',
    'Plaisance',
    'Pointe Larue',
    'Port Glaud',
    'Roche Caiman',
    'Saint Louis',
    'Takamaka',
    'Victoria',
  ],
  Praslin: ['Baie Sainte Anne', 'Grand Anse Praslin', "Baie Sainte Anne (Curieuse)"],
  'La Digue': ['La Digue'],
};

export const REGIONS = Object.keys(REGION_DISTRICTS);
