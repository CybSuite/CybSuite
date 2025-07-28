// Navigation types for the dynamic navbar and sidebar

export interface NavigationApp {
  name: string;
  color: string;
  is_selected: boolean;
}

export interface NavigationItem {
  name: string;
  url: string;
  is_selected: boolean;
  has_sidebar: boolean;
}

export interface NavigationMenuItem {
  name: string;
  items: NavigationItem[];
}

export interface SidebarItem {
  name: string;
  url: string;
  is_selected: boolean;
}

export interface Sidebar {
  has_sidebar: boolean;
  items: SidebarItem[];
}

export interface UserMenuItem {
  name: string;
  url: string;
  is_selected: boolean;
}

export interface UserMenu {
  settings: UserMenuItem;
}

export interface NavigationMeta {
  current_view: string;
  current_url_name: string;
  namespace: string | null;
}

export interface NavigationResponse {
  current_app: NavigationApp;
  available_apps: NavigationApp[];
  navbar_items: NavigationMenuItem[];
  sidebar: Sidebar;
  user_menu: UserMenu;
  meta: NavigationMeta;
}
