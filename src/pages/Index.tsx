import { useAppContext } from '@/context/AppContext';
import { SalesPersonDashboard } from '@/components/dashboards/SalesPersonDashboard';
import { SupervisorDashboard } from '@/components/dashboards/SupervisorDashboard';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { RepManagementDashboard } from '@/components/dashboards/RepManagementDashboard';

const Index = () => {
  const { currentUser } = useAppContext();

  switch (currentUser.orgRole) {
    case 'supervisor':
      return <SupervisorDashboard />;
    case 'sales_manager':
      return <ManagerDashboard />;
    case 'representative_management':
      return <RepManagementDashboard />;
    case 'sales_person':
      return <SalesPersonDashboard />;
    default:
      return <ManagerDashboard />;
  }
};

export default Index;
