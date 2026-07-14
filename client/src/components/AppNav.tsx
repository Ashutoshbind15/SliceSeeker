import { Fragment } from "react";
import { Link, useLocation } from "react-router";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

type NavItem = {
  name: string;
  path: string;
  description?: string;
  /** Parent process route — don't highlight when on a child path */
  exact?: boolean;
};

type NavSegment =
  | {
      kind: "links";
      items: NavItem[];
    }
  | {
      kind: "menu";
      label: string;
      items: NavItem[];
    };

const navSegments: NavSegment[] = [
  {
    kind: "links",
    items: [{ name: "Home", path: "/" }],
  },
  {
    kind: "menu",
    label: "Files",
    items: [
      {
        name: "Library",
        path: "/files",
        exact: true,
        description: "Browse & manage videos",
      },
      {
        name: "Upload",
        path: "/files/upload",
        description: "Add videos to a collection",
      },
    ],
  },
  {
    kind: "menu",
    label: "Multimodal",
    items: [
      { name: "Process", path: "/process", description: "Index videos" },
      { name: "Search", path: "/search", description: "Find moments" },
      { name: "Costs", path: "/costs", description: "Usage & spend" },
    ],
  },
  {
    kind: "menu",
    label: "Speech",
    items: [
      {
        name: "Process",
        path: "/transcribe",
        exact: true,
        description: "Transcribe audio",
      },
      {
        name: "Search",
        path: "/transcribe/search",
        description: "Find spoken words",
      },
      {
        name: "Costs",
        path: "/transcribe/costs",
        description: "Usage & spend",
      },
    ],
  },
  {
    kind: "menu",
    label: "Vision",
    items: [
      {
        name: "Process",
        path: "/frames",
        exact: true,
        description: "Index frames",
      },
      {
        name: "Search",
        path: "/frames/search",
        description: "Find what's on screen",
      },
      {
        name: "Costs",
        path: "/frames/costs",
        description: "Usage & spend",
      },
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

const isSegmentActive = (pathname: string, items: NavItem[]) =>
  items.some((item) => isNavItemActive(pathname, item));

const navTriggerClassName = cn(
  navigationMenuTriggerStyle(),
  "h-auto rounded-full px-3 py-1.5 bg-transparent shadow-none",
);

export const AppNav = () => {
  const location = useLocation();

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md max-w-[calc(100vw-2rem)]">
      <NavigationMenu viewport={false} className="max-w-none">
        <NavigationMenuList className="flex-wrap justify-start gap-0.5">
          {navSegments.map((segment, segmentIndex) => {
            if (segment.kind === "links") {
              return (
                <Fragment key={`links-${segmentIndex}`}>
                  {segment.items.map((item) => {
                    const isActive = isNavItemActive(
                      location.pathname,
                      item,
                    );
                    return (
                      <NavigationMenuItem key={item.path}>
                        <NavigationMenuLink
                          asChild
                          data-active={isActive ? "true" : undefined}
                          className={cn(
                            navTriggerClassName,
                            isActive &&
                              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground data-[active=true]:focus:bg-primary data-[active=true]:focus:text-primary-foreground",
                          )}
                        >
                          <Link to={item.path}>{item.name}</Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    );
                  })}
                </Fragment>
              );
            }

            const segmentActive = isSegmentActive(
              location.pathname,
              segment.items,
            );

            return (
              <NavigationMenuItem key={segment.label}>
                <NavigationMenuTrigger
                  className={cn(
                    navTriggerClassName,
                    segmentActive &&
                      "bg-primary/10 text-primary data-open:bg-primary/15 data-popup-open:bg-primary/15",
                  )}
                >
                  {segment.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-44 gap-0.5 p-1">
                    {segment.items.map((item) => {
                      const isActive = isNavItemActive(
                        location.pathname,
                        item,
                      );
                      return (
                        <li key={item.path}>
                          <NavigationMenuLink
                            asChild
                            data-active={isActive ? "true" : undefined}
                            className={cn(
                              "flex-col items-start gap-0.5 p-2.5",
                              isActive &&
                                "bg-muted data-[active=true]:bg-muted",
                            )}
                          >
                            <Link to={item.path}>
                              <span className="font-medium leading-none">
                                {item.name}
                              </span>
                              {item.description ? (
                                <span className="text-xs text-muted-foreground leading-snug">
                                  {item.description}
                                </span>
                              ) : null}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      );
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
      <div className="ml-1 pl-3 border-l shrink-0">
        <ModeToggle />
      </div>
    </div>
  );
};
