-- 1. İstifadəçilər (Layihəni ictimaiyyətə açsan, fərqli istifadəçilər qeydiyyatdan keçə bilər)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Kateqoriyalar / Teqlər (İş, Dərs, Şəxsi, Kodlar)
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#808080', -- UI üçün rəng kodu (hex)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Əsas Qeydlər Cədvəli (Knowledge Vault)
CREATE TABLE vaults (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT, -- Qeyd və ya kod parçası üçün
    url VARCHAR(2048), -- Əgər bu bir linkdirsə
    thumbnail_url VARCHAR(2048), -- Link Preview üçün şəkil (Metadata)
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('note', 'link', 'code', 'file')),
    is_archived BOOLEAN DEFAULT FALSE, -- İDEYA 2: Arxivləmə (Silmək əvəzinə gizlətmək)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Çoxlu-Çoxlu Əlaqə: Bir qeydin bir neçə teqi ola bilər (məsələn: həm 'İş', həm 'Kodlar')
CREATE TABLE vault_tags (
    vault_id INT REFERENCES vaults(id) ON DELETE CASCADE,
    tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (vault_id, tag_id)
);

-- 5. Media və Fayllar (Attachment) - İDEYA 3: Şəkil və ya PDF saxlamaq üçün
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    vault_id INT REFERENCES vaults(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50), -- Nümunə: pdf, image/jpeg və s.
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
