import { redirect } from "next/navigation";

/** Alias pratique vers la gestion centralisée des bannières et images. */
export default function AdminCodesMediaAliasPage(): never {
  redirect("/admin/media");
}
