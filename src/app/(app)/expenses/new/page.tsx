import { redirect } from 'next/navigation';

// The "+Create > Expense" quick action lands here. Expenses are recorded
// via a lightweight modal (see the Expense Transactions list page) rather
// than a full page, so we simply redirect there.
export default function NewExpenseRedirect() {
  redirect('/expenses');
}
