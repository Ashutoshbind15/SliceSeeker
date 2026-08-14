import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import {
  Cpu,
  DollarSign,
  FolderOpen,
  Images,
  Layers,
  Mic,
  Search,
  Upload,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Files",
    items: [
      { name: "Library", path: "/files", icon: FolderOpen, exact: true },
      { name: "Upload", path: "/files/upload", icon: Upload },
    ],
  },
  {
    label: "Multimodal",
    items: [
      { name: "Process", path: "/process", icon: Cpu },
      { name: "Search", path: "/search", icon: Search },
      { name: "Costs", path: "/costs", icon: DollarSign },
    ],
  },
  {
    label: "Speech",
    items: [
      { name: "Process", path: "/transcribe", icon: Mic, exact: true },
      { name: "Search", path: "/transcribe/search", icon: Search },
      { name: "Costs", path: "/transcribe/costs", icon: DollarSign },
    ],
  },
  {
    label: "Vision",
    items: [
      { name: "Process", path: "/frames", icon: Images, exact: true },
      { name: "Search", path: "/frames/search", icon: Search },
      { name: "Costs", path: "/frames/costs", icon: DollarSign },
    ],
  },
  {
    label: "Hybrid",
    items: [
      { name: "Process", path: "/hybrid", icon: Layers, exact: true },
      { name: "Search", path: "/hybrid/search", icon: Search },
      { name: "Costs", path: "/hybrid/costs", icon: DollarSign },
    ],
  },
];

const isNavItemActive = (pathname: string, item: NavItem) => {
  if (pathname === item.path) {
    return true;
  }

  if (item.exact || item.path === "/") {
    return false;
  }

  return pathname.startsWith(`${item.path}/`);
};

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 shrink-0 flex-row items-center gap-2 border-b border-border px-2 py-0">
        <SidebarMenu className="min-w-0 flex-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="SliceSeeker"
              className="group-data-[collapsible=icon]:justify-center"
            >
              <NavLink to="/files">
                <Search className="size-5" />
                <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                  SliceSeeker
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavItemActive(location.pathname, item)}
                      tooltip={item.name}
                    >
                      <NavLink to={item.path} end={item.exact || item.path === "/"}>
                        <item.icon />
                        <span>{item.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
