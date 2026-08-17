import StaffArchive from "./StaffArchive";
import { getStaffList } from "./staff-data";

export default function Home() {
  const staff = getStaffList();
  return <StaffArchive initialStaff={staff} />;
}
