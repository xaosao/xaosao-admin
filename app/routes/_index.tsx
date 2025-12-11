import { Link } from "@remix-run/react";

// import SignIn from "./signin";
export default function Index() {
  return (
    <>
      <Link to="/signin">Link to sign in</Link>
    </>
  )
}