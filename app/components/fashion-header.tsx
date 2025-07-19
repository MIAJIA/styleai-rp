import UserInfo from "./userInfo";



export default function FashionHeader() {
  return (
    <header className="relative px-6 py-8 flex justify-between items-center ">
      <div className="relative z-10">
        <h1 className="font-playfair text-4xl font-bold text-neutral-900 mb-1">StyleMe</h1>
        <p className="font-inter text-sm text-neutral-600">
          Create your perfect look with our virtual try-on
        </p>
      </div>
      <UserInfo />
    </header>
  );
}
