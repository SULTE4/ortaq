export interface CivicThemeSpec {
  id: 'civic-daylight';
  name: string;
  defaultNight: boolean;
  defaultWinter: boolean;
  cssVars: Record<string, string>;
  map: {
    snowGroundNight: string;
    snowGroundDay: string;
    blockNight: string;
    blockDay: string;
    roadNight: string;
    roadDay: string;
    roadCasingNight: string;
    roadCasingDay: string;
    footwayNight: string;
    footwayDay: string;
    roadMarkingNight: string;
    roadMarkingDay: string;
    parkNight: string;
    parkDay: string;
    waterNight: string;
    waterDay: string;
    neighborFacades: string[];
    nightMult: [number, number, number];
    roofSnowNight: string;
    roofSnowDay: string;
    streetTextNight: string;
    streetHaloNight: string;
    streetTextDay: string;
    streetHaloDay: string;
  };
  building: {
    tealMain: string;
    tealAlt: string;
    tealDark: string;
    brickMain: string;
    brickAlt: string;
    plinth: string;
    sillColor: string;
    windowFrame: string;
    roofSnow: string;
    roofSnowSide: string;
    roofEmissive: string;
    roofEmissiveIntensity: number;
    windowGold: [string, string, string, string];
    windowUnlit: [string, string];
    windowDay: [string, string, string, string];
    homeGold: string;
    votedEmerald: string;
  };
}

export const activePalette: CivicThemeSpec = {
  id: 'civic-daylight',
  name: 'Astana Civic Daylight',
  defaultNight: false,
  defaultWinter: true,
  cssVars: {
    '--night': '#F2F4F7',
    '--surface': '#FBFCFE',
    '--surface-2': '#EAEFF4',
    '--hairline': 'rgba(22, 34, 52, 0.09)',
    '--snow': '#16202C',
    '--muted': '#5B6878',
    '--action': '#0E6E7D',
    '--action-ink': '#FFFFFF',
    '--action-soft': '#E3F1F3',
    '--amber': '#8A510F',
    '--amber-pill': '#E2942A',
    '--amber-ink': '#1F1406',
    '--amber-soft': '#FCF1E2',
    '--teal': '#0E6E7D',
    '--brick': '#B46550',
    '--status-new': '#C94B4B',
    '--status-progress': '#C78018',
    '--status-resolved': '#1D835C',
    '--panel-shadow':
      '0 6px 20px rgba(18, 28, 42, 0.06), 0 1px 3px rgba(18, 28, 42, 0.04)',
  },
  map: {
    snowGroundNight: '#222933',
    snowGroundDay: '#E7EDF3',
    blockNight: '#28303C',
    blockDay: '#DCE3EC',
    roadNight: '#2E3846',
    roadDay: '#C4CDD6',
    roadCasingNight: '#364151',
    roadCasingDay: '#D4DCE4',
    footwayNight: '#2A3340',
    footwayDay: '#D0D8E0',
    roadMarkingNight: '#3F4B5B',
    roadMarkingDay: '#EDF2F7',
    parkNight: '#233030',
    parkDay: '#D5E0DA',
    waterNight: '#1B2836',
    waterDay: '#C1D5E2',
    neighborFacades: ['#E4E8EE', '#EAE7E2', '#DCE2E8', '#E6E1DC', '#E0E5EB'],
    nightMult: [0.34, 0.37, 0.42],
    roofSnowNight: '#4B5766',
    roofSnowDay: '#F4F7FA',
    streetTextNight: '#9BA8B8',
    streetHaloNight: '#222933',
    streetTextDay: '#4A5666',
    streetHaloDay: '#EEF2F6',
  },
  building: {
    tealMain: '#3E7484',
    tealAlt: '#4B8494',
    tealDark: '#2B505C',
    brickMain: '#B46550',
    brickAlt: '#9F5541',
    plinth: '#677684',
    sillColor: '#E5ECF2',
    windowFrame: '#2C3B47',
    roofSnow: '#F3F6FA',
    roofSnowSide: '#E1E7EF',
    roofEmissive: '#DCE4EE',
    roofEmissiveIntensity: 0.03,
    windowGold: ['#E2C18E', '#E8CCA0', '#D9B57E', '#EDE0CC'],
    windowUnlit: ['#435663', '#4E6270'],
    windowDay: ['#BFD6E4', '#B1CAD9', '#CADEE9', '#B6D0DF'],
    homeGold: '#E2942A',
    votedEmerald: '#55A383',
  },
};
