import { redirect } from "next/navigation";

// 面板已合并到主页（/user/profile），这里永久重定向。
export default function DashboardRedirect() {
  redirect("/user/profile");
}
