import { redirect } from "next/navigation";

export default function ExpensesIndexPage() {
  redirect("/expenses/monthly");
}

