import { redirect } from 'next/navigation';

export default function TeamOverviewRedirect() {
  redirect('/team/employees');
}
