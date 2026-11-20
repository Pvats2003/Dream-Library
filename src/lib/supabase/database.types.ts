
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"library_id": string,"undone_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"library_id": string,"undone_at"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"library_id"?: string,"undone_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "check_in_at": string,"check_out_at": string | null,"client_op_id": string | null,"created_at": string,"created_by": string | null,"id": string,"library_id": string,"method": Database["public"]['Enums']["attendance_method"],"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "check_in_at"?: string,"check_out_at"?: string | null,"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id": string,"method"?: Database["public"]['Enums']["attendance_method"],"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "check_in_at"?: string,"check_out_at"?: string | null,"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id"?: string,"method"?: Database["public"]['Enums']["attendance_method"],"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_student_id_library_id_fkey"
      columns: ["student_id","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"deposits": {
                  Row: {
                    "amount_paise": number,"created_at": string,"created_by": string | null,"id": string,"library_id": string,"method": Database["public"]['Enums']["payment_method"],"received_at": string,"settled_at": string | null,"settled_note": string | null,"status": Database["public"]['Enums']["deposit_status"],"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id": string,"method"?: Database["public"]['Enums']["payment_method"],"received_at"?: string,"settled_at"?: string | null,"settled_note"?: string | null,"status"?: Database["public"]['Enums']["deposit_status"],"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"received_at"?: string,"settled_at"?: string | null,"settled_note"?: string | null,"status"?: Database["public"]['Enums']["deposit_status"],"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deposits_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deposits_student_id_library_id_fkey"
      columns: ["student_id","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_paise": number,"category": Database["public"]['Enums']["expense_category"],"client_op_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"library_id": string,"note": string | null,"spent_on": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"category": Database["public"]['Enums']["expense_category"],"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"library_id": string,"note"?: string | null,"spent_on"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"category"?: Database["public"]['Enums']["expense_category"],"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"library_id"?: string,"note"?: string | null,"spent_on"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_due_paise": number,"amount_paid_paise": number,"created_at": string,"created_by": string | null,"due_date": string,"id": string,"library_id": string,"note": string | null,"period_end": string | null,"period_start": string | null,"snoozed_until": string | null,"status": Database["public"]['Enums']["invoice_status"],"student_id": string,"subscription_id": string | null,"updated_at": string,"waived_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due_paise": number,"amount_paid_paise"?: number,"created_at"?: string,"created_by"?: string | null,"due_date": string,"id"?: string,"library_id": string,"note"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"snoozed_until"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"student_id": string,"subscription_id"?: string | null,"updated_at"?: string,"waived_reason"?: string | null
                  }
                  Update: {
                    "amount_due_paise"?: number,"amount_paid_paise"?: number,"created_at"?: string,"created_by"?: string | null,"due_date"?: string,"id"?: string,"library_id"?: string,"note"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"snoozed_until"?: string | null,"status"?: Database["public"]['Enums']["invoice_status"],"student_id"?: string,"subscription_id"?: string | null,"updated_at"?: string,"waived_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_library_id_fkey"
      columns: ["student_id","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "invoices_subscription_id_library_id_fkey"
      columns: ["subscription_id","library_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"library_id": string,"message": string | null,"name": string,"phone": string,"source": Database["public"]['Enums']["student_source"] | null,"status": Database["public"]['Enums']["lead_status"],"trial_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id": string,"message"?: string | null,"name": string,"phone": string,"source"?: Database["public"]['Enums']["student_source"] | null,"status"?: Database["public"]['Enums']["lead_status"],"trial_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id"?: string,"message"?: string | null,"name"?: string,"phone"?: string,"source"?: Database["public"]['Enums']["student_source"] | null,"status"?: Database["public"]['Enums']["lead_status"],"trial_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"libraries": {
                  Row: {
                    "address": string | null,"brand_color": string,"city": string | null,"created_at": string,"created_by": string | null,"currency": string,"id": string,"lat": number | null,"lng": number | null,"logo_path": string | null,"name": string,"receipt_prefix": string,"settings": NonNullable<Json>,"setup_completed_at": string | null,"slug": string,"timezone": string,"updated_at": string,"upi_id": string | null,"whatsapp_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"brand_color"?: string,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"logo_path"?: string | null,"name": string,"receipt_prefix"?: string,"settings"?: NonNullable<Json>,"setup_completed_at"?: string | null,"slug": string,"timezone"?: string,"updated_at"?: string,"upi_id"?: string | null,"whatsapp_number"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"brand_color"?: string,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"logo_path"?: string | null,"name"?: string,"receipt_prefix"?: string,"settings"?: NonNullable<Json>,"setup_completed_at"?: string | null,"slug"?: string,"timezone"?: string,"updated_at"?: string,"upi_id"?: string | null,"whatsapp_number"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"created_by": string | null,"display_name": string,"id": string,"is_active": boolean,"library_id": string,"permissions": NonNullable<Json>,"phone": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"display_name": string,"id"?: string,"is_active"?: boolean,"library_id": string,"permissions"?: NonNullable<Json>,"phone": string,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"display_name"?: string,"id"?: string,"is_active"?: boolean,"library_id"?: string,"permissions"?: NonNullable<Json>,"phone"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"message_templates": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"key": string,"library_id": string,"locale": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"key": string,"library_id": string,"locale": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"key"?: string,"library_id"?: string,"locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_templates_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"client_op_id": string | null,"created_at": string,"created_by": string | null,"id": string,"invoice_id": string,"library_id": string,"method": Database["public"]['Enums']["payment_method"],"receipt_number": string | null,"receipt_token": string,"received_at": string,"received_by": string | null,"reference": string | null,"reversal_reason": string | null,"reverses_payment_id": string | null,"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id": string,"library_id": string,"method": Database["public"]['Enums']["payment_method"],"receipt_number"?: string | null,"receipt_token"?: string,"received_at"?: string,"received_by"?: string | null,"reference"?: string | null,"reversal_reason"?: string | null,"reverses_payment_id"?: string | null,"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id"?: string,"library_id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"receipt_number"?: string | null,"receipt_token"?: string,"received_at"?: string,"received_by"?: string | null,"reference"?: string | null,"reversal_reason"?: string | null,"reverses_payment_id"?: string | null,"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_invoice_id_library_id_fkey"
      columns: ["invoice_id","library_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "payments_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_reverses_payment_id_library_id_fkey"
      columns: ["reverses_payment_id","library_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "payments_student_id_library_id_fkey"
      columns: ["student_id","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"duration_days": number | null,"duration_months": number | null,"id": string,"is_active": boolean,"library_id": string,"name": string,"price_paise": number,"shift_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"duration_days"?: number | null,"duration_months"?: number | null,"id"?: string,"is_active"?: boolean,"library_id": string,"name": string,"price_paise": number,"shift_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"duration_days"?: number | null,"duration_months"?: number | null,"id"?: string,"is_active"?: boolean,"library_id"?: string,"name"?: string,"price_paise"?: number,"shift_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plans_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plans_shift_id_library_id_fkey"
      columns: ["shift_id","library_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"is_platform_admin": boolean,"locale": string,"phone": string | null,"theme": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"is_platform_admin"?: boolean,"locale"?: string,"phone"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"is_platform_admin"?: boolean,"locale"?: string,"phone"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"receipt_counters": {
                  Row: {
                    "last_number": number,"library_id": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"library_id": string,"year": number
                  }
                  Update: {
                    "last_number"?: number,"library_id"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_counters_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "body": string | null,"channel": string,"client_op_id": string | null,"created_at": string,"created_by": string | null,"id": string,"invoice_id": string | null,"library_id": string,"sent_at": string,"sent_by": string | null,"student_id": string,"template_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"channel"?: string,"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id"?: string | null,"library_id": string,"sent_at"?: string,"sent_by"?: string | null,"student_id": string,"template_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"channel"?: string,"client_op_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invoice_id"?: string | null,"library_id"?: string,"sent_at"?: string,"sent_by"?: string | null,"student_id"?: string,"template_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_invoice_id_library_id_fkey"
      columns: ["invoice_id","library_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "reminders_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_student_id_library_id_fkey"
      columns: ["student_id","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"seats": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"label": string,"library_id": string,"rotation": number,"tags": (string)[],"updated_at": string,"x": number,"y": number,"zone_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"label": string,"library_id": string,"rotation"?: number,"tags"?: (string)[],"updated_at"?: string,"x"?: number,"y"?: number,"zone_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"label"?: string,"library_id"?: string,"rotation"?: number,"tags"?: (string)[],"updated_at"?: string,"x"?: number,"y"?: number,"zone_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seats_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seats_zone_id_library_id_fkey"
      columns: ["zone_id","library_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"shifts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"end_min": number,"id": string,"is_active": boolean,"is_full_day": boolean,"library_id": string,"minutes": unknown,"name": string,"sort_order": number,"start_min": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"end_min": number,"id"?: string,"is_active"?: boolean,"is_full_day"?: boolean,"library_id": string,"minutes"?: never,"name": string,"sort_order"?: number,"start_min": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"end_min"?: number,"id"?: string,"is_active"?: boolean,"is_full_day"?: boolean,"library_id"?: string,"minutes"?: never,"name"?: string,"sort_order"?: number,"start_min"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "address": string | null,"alt_phone": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"exam_target": string | null,"gender": Database["public"]['Enums']["gender"] | null,"guardian_phone": string | null,"id": string,"id_proof_path": string | null,"joined_on": string,"library_id": string,"name": string,"notes": string | null,"phone": string,"photo_path": string | null,"referred_by": string | null,"source": Database["public"]['Enums']["student_source"] | null,"status": Database["public"]['Enums']["student_status"],"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"alt_phone"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"exam_target"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"guardian_phone"?: string | null,"id"?: string,"id_proof_path"?: string | null,"joined_on"?: string,"library_id": string,"name": string,"notes"?: string | null,"phone": string,"photo_path"?: string | null,"referred_by"?: string | null,"source"?: Database["public"]['Enums']["student_source"] | null,"status"?: Database["public"]['Enums']["student_status"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"alt_phone"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"exam_target"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"guardian_phone"?: string | null,"id"?: string,"id_proof_path"?: string | null,"joined_on"?: string,"library_id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string,"photo_path"?: string | null,"referred_by"?: string | null,"source"?: Database["public"]['Enums']["student_source"] | null,"status"?: Database["public"]['Enums']["student_status"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_referred_by_library_id_fkey"
      columns: ["referred_by","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"subscription_pauses": {
                  Row: {
                    "created_at": string,"created_by": string | null,"from_date": string,"id": string,"library_id": string,"reason": string | null,"subscription_id": string,"to_date": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"from_date": string,"id"?: string,"library_id": string,"reason"?: string | null,"subscription_id": string,"to_date": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"from_date"?: string,"id"?: string,"library_id"?: string,"reason"?: string | null,"subscription_id"?: string,"to_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_pauses_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_pauses_subscription_id_library_id_fkey"
      columns: ["subscription_id","library_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "active_dates": unknown,"auto_renew": boolean,"billing_day": number,"cancelled_at": string | null,"created_at": string,"created_by": string | null,"discount_paise": number,"discount_reason": string | null,"end_date": string,"id": string,"library_id": string,"plan_id": string,"price_paise": number,"renewed_from_id": string | null,"seat_id": string | null,"shift_id": string,"shift_minutes": unknown,"start_date": string,"status": Database["public"]['Enums']["subscription_status"],"student_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_dates"?: never,"auto_renew"?: boolean,"billing_day": number,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"discount_paise"?: number,"discount_reason"?: string | null,"end_date": string,"id"?: string,"library_id": string,"plan_id": string,"price_paise": number,"renewed_from_id"?: string | null,"seat_id"?: string | null,"shift_id": string,"shift_minutes": unknown,"start_date": string,"status"?: Database["public"]['Enums']["subscription_status"],"student_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active_dates"?: never,"auto_renew"?: boolean,"billing_day"?: number,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"discount_paise"?: number,"discount_reason"?: string | null,"end_date"?: string,"id"?: string,"library_id"?: string,"plan_id"?: string,"price_paise"?: number,"renewed_from_id"?: string | null,"seat_id"?: string | null,"shift_id"?: string,"shift_minutes"?: unknown,"start_date"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"student_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_library_id_fkey"
      columns: ["plan_id","library_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "subscriptions_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_seat_id_library_id_fkey"
      columns: ["seat_id","library_id"]
isOneToOne: false
      referencedRelation: "seats"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "subscriptions_shift_id_library_id_fkey"
      columns: ["shift_id","library_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "subscriptions_student_id_library_id_fkey"
      columns: ["student_id","library_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id","library_id"]
    }
                  ]
                },"waitlist": {
                  Row: {
                    "created_at": string,"created_by": string | null,"desired_shift_id": string | null,"desired_zone_id": string | null,"id": string,"library_id": string,"name": string,"note": string | null,"phone": string,"status": Database["public"]['Enums']["waitlist_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"desired_shift_id"?: string | null,"desired_zone_id"?: string | null,"id"?: string,"library_id": string,"name": string,"note"?: string | null,"phone": string,"status"?: Database["public"]['Enums']["waitlist_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"desired_shift_id"?: string | null,"desired_zone_id"?: string | null,"id"?: string,"library_id"?: string,"name"?: string,"note"?: string | null,"phone"?: string,"status"?: Database["public"]['Enums']["waitlist_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "waitlist_desired_shift_id_library_id_fkey"
      columns: ["desired_shift_id","library_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "waitlist_desired_zone_id_library_id_fkey"
      columns: ["desired_zone_id","library_id"]
isOneToOne: false
      referencedRelation: "zones"
      referencedColumns: ["id","library_id"]
    },{
      foreignKeyName: "waitlist_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                },"zones": {
                  Row: {
                    "attributes": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": string,"library_id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attributes"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id": string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "attributes"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"library_id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "zones_library_id_fkey"
      columns: ["library_id"]
isOneToOne: false
      referencedRelation: "libraries"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "my_memberships":
{ Args: Record<PropertyKey, never>; Returns: {
              "library_id": string,"library_name": string,"library_slug": string,"membership_id": string,"permissions": Json,"role": Database["public"]['Enums']["member_role"],"setup_completed": boolean
            }[]
                           },
"today_summary":
{ Args: { "lib": string,"on_date": string }; Returns: Json
                           }
          }
          Enums: {
            "attendance_method": "qr"|"manual","deposit_status": "held"|"refunded"|"adjusted","expense_category": "rent"|"electricity"|"internet"|"salary"|"maintenance"|"other","gender": "male"|"female"|"other","invoice_status": "due"|"partial"|"paid"|"waived","lead_status": "new"|"contacted"|"trial_booked"|"converted"|"lost","member_role": "owner"|"manager"|"desk","payment_method": "cash"|"upi"|"card"|"bank","student_source": "walk_in"|"referral"|"instagram"|"google"|"whatsapp"|"other","student_status": "active"|"paused"|"left","subscription_status": "upcoming"|"active"|"paused"|"expired"|"cancelled","waitlist_status": "waiting"|"offered"|"converted"|"dropped"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "attendance_method": ["qr", "manual"],"deposit_status": ["held", "refunded", "adjusted"],"expense_category": ["rent", "electricity", "internet", "salary", "maintenance", "other"],"gender": ["male", "female", "other"],"invoice_status": ["due", "partial", "paid", "waived"],"lead_status": ["new", "contacted", "trial_booked", "converted", "lost"],"member_role": ["owner", "manager", "desk"],"payment_method": ["cash", "upi", "card", "bank"],"student_source": ["walk_in", "referral", "instagram", "google", "whatsapp", "other"],"student_status": ["active", "paused", "left"],"subscription_status": ["upcoming", "active", "paused", "expired", "cancelled"],"waitlist_status": ["waiting", "offered", "converted", "dropped"]
          }
        }
} as const
