import { redirect } from "next/navigation";

/** Alias pratique vers la gestion centralisée des bannières et images. */
export default function AdminWebsiteMediaAliasPage(): never {
  redirect("/admin/media");
}
