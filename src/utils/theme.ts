export const getBackgroundGradient = (theme: string, isDarkMode: boolean = false): [string, string] => {
  if (isDarkMode) {
    switch (theme) {
      case 'washi':    return ['#2C2C2E', '#1C1C1E'];
      case 'corkboard':return ['#3D2B1F', '#241A13'];
      case 'wood':     return ['#2D1B13', '#1A0F0B'];
      case 'sakura':   return ['#3D1F28', '#241318'];
      case 'matcha':   return ['#1F2D1F', '#131A13'];
      case 'aizome':   return ['#1F283D', '#131824'];
      case 'momiji':   return ['#3D1F13', '#24130B'];
      default:         return ['#1C1C1E', '#111111'];
    }
  }

  switch (theme) {
    case 'washi':    return ['#FAF7F0', '#F0E8D8'];
    case 'corkboard':return ['#C89D7C', '#A0785A'];
    case 'wood':     return ['#8D6E63', '#5D4037'];
    case 'sakura':   return ['#FCEEF3', '#F9D0DF'];
    case 'matcha':   return ['#D8EDD8', '#B8D4B0'];
    case 'aizome':   return ['#5B8DB8', '#3A6A96'];
    case 'momiji':   return ['#EDA878', '#D4764A'];
    default:         return ['#E8EDF2', '#D0D7E0'];
  }
};

export const getThemeColors = (isDarkMode: boolean) => {
  return {
    cardBg: isDarkMode ? '#1C1C1E' : '#FFFFFF',
    textMain: isDarkMode ? '#FFFFFF' : '#1A1A2E',
    textSub: isDarkMode ? '#A1A1AA' : '#8E8E93',
    binding: isDarkMode ? '#2C2C2E' : '#F1F3F5',
    scheduleSection: isDarkMode ? '#252525' : '#F5EFE6',
    border: isDarkMode ? '#3A3A3C' : '#E0E0E0',
    emptyStateIcon: isDarkMode ? '#48484A' : '#E5E5EA',
  };
};
