<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Super Admin Allowlist
    |--------------------------------------------------------------------------
    |
    | Emails listed here are always treated as platform super admins, in
    | addition to any user with the `is_super_admin` column set. This lets you
    | bootstrap admin access via env without touching the database.
    |
    | SUPER_ADMIN_EMAILS="jack@jackonthe.net,other@example.com"
    |
    */

    'emails' => array_values(array_filter(array_map(
        fn ($email) => strtolower(trim($email)),
        explode(',', (string) env('SUPER_ADMIN_EMAILS', '')),
    ))),

];
