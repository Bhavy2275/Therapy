import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

/**
 * POST /api/admin/platform-settings/upload-qr
 * Accepts multipart/form-data with a "file" field.
 * Admin-only. Uploads donation QR code and returns the public or data URL.
 */
export async function POST(req: Request) {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verify admin role
    const { data: userRow } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed formats: PNG, JPG, JPEG, WEBP, SVG.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum size of 5MB.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `donation-qr-${Date.now()}.${fileExt}`;

    let qrUrl = '';

    // Attempt to upload to Supabase Storage in 'platform-assets' bucket
    try {
      // Ensure bucket exists
      await adminClient.storage.createBucket('platform-assets', {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });

      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from('platform-assets')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = adminClient.storage
          .from('platform-assets')
          .getPublicUrl(uploadData.path);

        if (urlData?.publicUrl) {
          qrUrl = urlData.publicUrl;
        }
      }
    } catch {
      // Storage upload fallback
    }

    // Fallback: If storage bucket upload didn't yield a URL, use an inline Data URI
    if (!qrUrl) {
      qrUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    }

    // Persist immediately in platform_settings table
    await adminClient
      .from('platform_settings')
      .upsert({ key: 'upi_qr_url', value: qrUrl }, { onConflict: 'key' });

    return NextResponse.json({
      success: true,
      url: qrUrl,
      message: 'QR Code uploaded and saved successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/upload-qr] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
