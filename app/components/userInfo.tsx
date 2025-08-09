'use client'
import { signIn, signOut, useSession } from 'next-auth/react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, LogOut, Settings } from "lucide-react"
import { useRouter } from 'next/navigation'
import { generateDefaultAvatarUrl } from "@/lib/avatar-generator"

export default function UserInfo() {
    const { data: session } = useSession()
    const router = useRouter()

    if (!session) {
        return (
            <button className='border border-black rounded-lg px-5 py-1 bg-black text-white hover:bg-gray-800 transition-colors' onClick={() => router.push('/login')}>Login</button>
        )
    }

    const handleSignOut = () => {
        signOut({ callbackUrl: '/' })
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                    <Avatar className="w-8 h-8">
                        <AvatarImage 
                            src={session.user?.image || generateDefaultAvatarUrl()} 
                            alt="Avatar"
                        />
                        <AvatarFallback>
                            <User className="h-4 w-4" />
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-700 font-medium">
                        {session.user?.name}
                    </span>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{session.user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {session.user?.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* <DropdownMenuItem onClick={() => router.push('/profile/avatar')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>头像设置</span>
                </DropdownMenuItem> */}
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}