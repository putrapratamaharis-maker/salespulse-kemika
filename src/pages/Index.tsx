import { useAppContext } from '@/context/AppContext';
import { SalesPersonDashboard } from '@/components/dashboards/SalesPersonDashboard';
import { SupervisorDashboard } from '@/components/dashboards/SupervisorDashboard';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { RepManagementDashboard } from '@/components/dashboards/RepManagementDashboard';

const Index = () => {
  const { currentUser } = useAppContext();

  switch (currentUser.orgRole) {
    case 'sales_person':
      return <SalesPersonDashboard />;
    case 'supervisor':
      return <SupervisorDashboard />;
    case 'sales_manager':
      return <ManagerDashboard />;
    case 'representative_management':
      return <RepManagementDashboard />;
    default:
      return <ManagerDashboard />;
  }
};

export default Index;
