// src/user/user.controller.ts
import { Controller,Get, Put, Post, Body, Req, UnauthorizedException, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import { supabase } from '../auth/supabaseClient';
import { ProfileUpdateDto } from './dto/profile-update.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(
      private prisma: PrismaService,
      private readonly userService: UserService
    ) {}

    @Put('profile')
    async updateProfile(@Body() profileData: ProfileUpdateDto, @Req() req: Request) {
        const accessToken = req.headers.authorization?.split(' ')[1]; // Extract the token

        // Get the authenticated user from Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            throw new UnauthorizedException('User is not authenticated');
        }

        // 2. Update or Create User record in the database (Prisma)
        const updatedUser = await this.prisma.user.upsert({
            where: { supabaseId: user.id },  // Use the Supabase user ID as a unique identifier
            update: {
                fullName: profileData.fullName,
                phone: profileData.phone,
                country: profileData.country,
                preferredLang: profileData.preferredLang,
            },
            create: {
                supabaseId: user.id,  // Insert the Supabase user ID during record creation
                email: user.email,
                fullName: profileData.fullName,
                phone: profileData.phone,
                country: profileData.country,
                dateOfBirth: new Date(profileData.dateOfBirth),
                preferredLang: profileData.preferredLang,
            },
        });

        return updatedUser;
    }

    // Get user profile
    @Get('profile')
    async getProfile(@Req() req: Request) {
        const accessToken = req.headers.authorization?.split(' ')[1];

        // Get the authenticated user from Supabase
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (error || !user) {
            throw new UnauthorizedException('User is not authenticated');
        }

        // Fetch user from the database using Prisma
        const userProfile = await this.prisma.user.findUnique({
            where: { supabaseId: user.id },
        });

        if (!userProfile) {
            throw new UnauthorizedException('User profile not found');
        }

        return userProfile;
    }


    // Fetch user's contacts based on the supabaseId query parameter
  @Get('contacts')
  async getContacts(@Query('userId') userId: string) {
    // Ensure supabaseId is provided as a query parameter
    if (!userId) {
      throw new UnauthorizedException('supabaseId is required');
    }

    // Fetch the user from the database using the provided supabaseId
    const dbUser = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User profile not found');
    }

    // Fetch the user's contacts from the Contact table using Prisma
    const contacts = await this.prisma.contact.findMany({
      where: { userId: dbUser.id }, // Get contacts where the user is the owner
      include: {
        receiver: true, // Include receiver details (the contact's user data)
      },
    });

    // Return the contacts
    return contacts.map(contact => ({
      id: contact.receiver.id,
      fullName: contact.receiver.fullName,
      email: contact.receiver.email,
      phone: contact.receiver.phone,
      country: contact.receiver.country,
      preferredLang: contact.receiver.preferredLang,
    }));
  }




 @Post('fcmtoken')
  async updateFcmToken(@Body('fcmToken') fcmToken: string, @Req() req: Request) {
    // Extract the access token from the authorization header
    const accessToken = req.headers.authorization?.split(' ')[1]; // Extract the token

    if (!accessToken) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    // Get the authenticated user from Supabase Auth using the access token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // Call the service to update the FCM token for the user
    const updatedUser = await this.userService.updateFcmToken(user.id, fcmToken);

    // Return the updated user data (or just a success message if necessary)
    return updatedUser;
  }

}
