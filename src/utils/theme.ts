export const getBackgroundGradient = (theme: string): [string, string] => {
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
