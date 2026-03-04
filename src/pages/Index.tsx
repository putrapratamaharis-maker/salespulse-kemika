import { useAppContext } from '@/context/AppContext';
import { SalesPersonDashboard } from '@/components/dashboards/SalesPersonDashboard';
import { SupervisorDashboard } from '@/components/dashboards/SupervisorDashboard';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { RepManagementDashboard } from '@/components/dashboards/RepManagementDashboard';

const Index = () => {
  const { currentUser } = useAppContext();

  // Executive Summary is the same for all roles
  return <ManagerDashboard />;
};

export default Index;
