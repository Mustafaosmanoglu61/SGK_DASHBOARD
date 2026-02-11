{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.local/schemas/sgk-rpa-transaction.schema.json",
  "title": "SGK RPA Transaction Record Set",
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": true,
    "required": [
      "tc_masked",
      "ad",
      "soyad",
      "departman",
      "isyeri",
      "pozisyon",
      "unvan",
      "status",
      "start_date",
      "end_date",
      "date_key",
      "uyruk",
      "meslek_kodu",
      "bordro",
      "egitim",
      "calisan_kategori",
      "gorev_kategori"
    ],
    "properties": {
      "tc_masked": { "type": "string", "minLength": 3 },
      "ad": { "type": "string", "minLength": 1 },
      "soyad": { "type": "string", "minLength": 1 },

      "ise_giris_tarihi": { "type": "string" },

      "departman": { "type": "string", "minLength": 1 },
      "isyeri": { "type": "string", "minLength": 1 },
      "pozisyon": { "type": "string", "minLength": 1 },
      "unvan": { "type": "string", "minLength": 1 },

      "status": { "type": "string", "enum": ["COMPLETED", "ERROR"] },

      "start_date": { "type": "string", "format": "date-time" },
      "end_date": { "type": "string", "format": "date-time" },
      "date_key": { "type": "string", "format": "date" },

      "duration_sec": { "type": "integer", "minimum": 0 },

      "error_comment": { "type": "string" },

      "uyruk": { "type": "string", "minLength": 1 },
      "meslek_kodu": { "type": "string", "minLength": 1 },
      "bordro": { "type": "string", "minLength": 1 },
      "egitim": { "type": "string", "minLength": 1 },

      "calisan_kategori": { "type": "string", "minLength": 1 },
      "gorev_kategori": { "type": "string", "minLength": 1 },

      "esnek_meslek": { "type": "string" }
    },

    "allOf": [
      {
        "if": { "properties": { "status": { "const": "ERROR" } }, "required": ["status"] },
        "then": { "required": ["error_comment"] }
      }
    ]
  }
}
