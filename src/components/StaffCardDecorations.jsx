import staffCardChipIconA from '../assets/StaffCardChipIconA.png';
import staffCardChipIconB from '../assets/StaffCardChipIconB.png';
import staffCardChipIconC from '../assets/StaffCardChipIconC.png';
import staffCardOrbit from '../assets/StaffCardOrbit.png';

const commonChipIcons = [staffCardChipIconA, staffCardChipIconB];

export { staffCardOrbit };

export function getStaffCardChipIcon(serviceType, index = 0) {
  if (serviceType === 'special') return staffCardChipIconC;
  return commonChipIcons[index] || commonChipIcons[0];
}
