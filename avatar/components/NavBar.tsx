"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@nextui-org/react";
import { GithubIcon } from "./Icons";
import { ThemeSwitch } from "./ThemeSwitch";

export default function NavBar() {
  return (
    <Navbar className="w-full">
      <NavbarBrand className="flex justify-center items-center w-full">
        <p>Henry Gardner DS 266 NLP Final Project</p>
      </NavbarBrand>
      <NavbarContent justify="center">
      </NavbarContent>
    </Navbar>
  );
}
