<?php
/**
 * Cookie Testing Script for Sessner Extension
 *
 * This script provides endpoints to test cookie isolation between sessions.
 * Similar to httpbin.org/cookies but self-hosted.
 *
 * Usage:
 * 1. Upload this file to your web server
 * 2. Access: https://yoursite.com/cookie-test.php
 * 3. Use the buttons to test different scenarios
 */

// Enable CORS for testing
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Get action from query string
$action = isset($_GET['action']) ? $_GET['action'] : 'home';

/**
 * Set a cookie and redirect to the display page
 */
if ($action === 'set') {
    $cookieName = isset($_GET['name']) ? $_GET['name'] : 'test';
    $cookieValue = isset($_GET['value']) ? $_GET['value'] : 'value';
    $path = isset($_GET['path']) ? $_GET['path'] : '/';
    $domain = isset($_GET['domain']) ? $_GET['domain'] : '';
    $secure = isset($_GET['secure']) && $_GET['secure'] === 'true';
    $httponly = isset($_GET['httponly']) && $_GET['httponly'] === 'true';

    // Set cookie
    setcookie(
        $cookieName,
        $cookieValue,
        [
            'expires' => time() + 3600, // 1 hour
            'path' => $path,
            'domain' => $domain,
            'secure' => $secure,
            'httponly' => $httponly,
            'samesite' => 'Lax'
        ]
    );

    // Redirect to display page
    header('Location: ?action=display&set=' . urlencode($cookieName));
    exit;
}

/**
 * Display current cookies as JSON
 */
if ($action === 'display' || $action === 'json') {
    $cookies = $_COOKIE;

    // Add metadata
    $result = [
        'cookies' => $cookies,
        'count' => count($cookies),
        'timestamp' => date('Y-m-d H:i:s'),
        'server' => $_SERVER['SERVER_NAME'] ?? 'localhost'
    ];

    if ($action === 'json') {
        header('Content-Type: application/json');
        echo json_encode($result, JSON_PRETTY_PRINT);
        exit;
    }
}

/**
 * Clear all cookies
 */
if ($action === 'clear') {
    foreach ($_COOKIE as $name => $value) {
        setcookie($name, '', [
            'expires' => time() - 3600,
            'path' => '/'
        ]);
    }

    header('Location: ?action=display&cleared=1');
    exit;
}

/**
 * Clear specific cookie
 */
if ($action === 'delete') {
    $cookieName = isset($_GET['name']) ? $_GET['name'] : '';
    if ($cookieName) {
        setcookie($cookieName, '', [
            'expires' => time() - 3600,
            'path' => '/'
        ]);
    }

    header('Location: ?action=display&deleted=' . urlencode($cookieName));
    exit;
}

// Get current cookies for display
$currentCookies = $_COOKIE;
$cookieCount = count($currentCookies);
$justSet = isset($_GET['set']) ? $_GET['set'] : null;
$justCleared = isset($_GET['cleared']) ? true : false;
$justDeleted = isset($_GET['deleted']) ? $_GET['deleted'] : null;

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cookie Testing Tool - Sessner Extension</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }

        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }

        .alert {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .alert-info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }

        .quick-tests {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .btn {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-success {
            background: #28a745;
            color: white;
        }

        .btn-success:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
        }

        .btn-danger {
            background: #dc3545;
            color: white;
        }

        .btn-danger:hover {
            background: #c82333;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background: #5a6268;
        }

        .btn-small {
            padding: 6px 12px;
            font-size: 12px;
        }

        .cookie-list {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }

        .cookie-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-left: 4px solid #667eea;
        }

        .cookie-item:last-child {
            margin-bottom: 0;
        }

        .cookie-name {
            font-weight: 600;
            color: #333;
            font-size: 14px;
        }

        .cookie-value {
            color: #666;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin-top: 5px;
        }

        .cookie-empty {
            text-align: center;
            color: #999;
            padding: 40px;
            font-size: 16px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }

        input[type="text"] {
            width: 100%;
            padding: 10px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
        }

        .checkbox-group {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section-title {
            font-size: 18px;
            color: #333;
            margin-bottom: 15px;
            font-weight: 600;
        }

        .json-output {
            background: #282c34;
            color: #abb2bf;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            overflow-x: auto;
            line-height: 1.6;
        }

        .instructions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .instructions h3 {
            margin-bottom: 10px;
            font-size: 16px;
        }

        .instructions ol {
            margin-left: 20px;
        }

        .instructions li {
            margin-bottom: 8px;
            font-size: 14px;
        }

        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            background: #667eea;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header Card -->
        <div class="card">
            <h1>🍪 Cookie Testing Tool</h1>
            <p class="subtitle">Test cookie isolation for Sessner Multi-Session Manager Extension</p>

            <?php if ($justSet): ?>
                <div class="alert alert-success">
                    ✓ Cookie <strong><?php echo htmlspecialchars($justSet); ?></strong> has been set successfully!
                </div>
            <?php endif; ?>

            <?php if ($justCleared): ?>
                <div class="alert alert-success">
                    ✓ All cookies have been cleared successfully!
                </div>
            <?php endif; ?>

            <?php if ($justDeleted): ?>
                <div class="alert alert-success">
                    ✓ Cookie <strong><?php echo htmlspecialchars($justDeleted); ?></strong> has been deleted!
                </div>
            <?php endif; ?>

            <div class="alert alert-info">
                <strong>Current Cookie Count:</strong> <span class="badge"><?php echo $cookieCount; ?></span>
            </div>
        </div>

        <!-- Testing Instructions -->
        <div class="card">
            <div class="instructions">
                <h3>📋 How to Test Cookie Isolation</h3>
                <ol>
                    <li>Create <strong>Session A</strong> in Sessner extension</li>
                    <li>Navigate to this page and click "Set testA Cookie"</li>
                    <li>Verify you see <code>testA: valueA</code> in the cookie list</li>
                    <li>Create <strong>Session B</strong> in Sessner extension</li>
                    <li>Navigate to this page and click "Set testB Cookie"</li>
                    <li>Verify you see <code>testB: valueB</code> in the cookie list</li>
                    <li>Switch back to <strong>Session A</strong> and refresh</li>
                    <li>You should ONLY see <code>testA: valueA</code> (testB should not appear)</li>
                    <li>Switch back to <strong>Session B</strong> and refresh</li>
                    <li>You should ONLY see <code>testB: valueB</code> (testA should not appear)</li>
                </ol>
            </div>
        </div>

        <!-- Quick Test Buttons -->
        <div class="card">
            <h2 class="section-title">⚡ Quick Tests</h2>
            <div class="quick-tests">
                <a href="?action=set&name=testA&value=valueA" class="btn btn-primary">
                    Set testA Cookie
                </a>
                <a href="?action=set&name=testB&value=valueB" class="btn btn-success">
                    Set testB Cookie
                </a>
                <a href="?action=set&name=testC&value=valueC" class="btn btn-primary">
                    Set testC Cookie
                </a>
                <a href="?action=json" class="btn btn-secondary">
                    View JSON
                </a>
                <a href="?action=display" class="btn btn-secondary">
                    Refresh Display
                </a>
                <a href="?action=clear" class="btn btn-danger">
                    Clear All Cookies
                </a>
            </div>
        </div>

        <!-- Custom Cookie Form -->
        <div class="card">
            <h2 class="section-title">🎛️ Custom Cookie</h2>
            <form action="?action=set" method="GET">
                <input type="hidden" name="action" value="set">

                <div class="form-group">
                    <label for="name">Cookie Name:</label>
                    <input type="text" id="name" name="name" value="customCookie" required>
                </div>

                <div class="form-group">
                    <label for="value">Cookie Value:</label>
                    <input type="text" id="value" name="value" value="customValue" required>
                </div>

                <div class="form-group">
                    <label for="path">Path:</label>
                    <input type="text" id="path" name="path" value="/" placeholder="/">
                </div>

                <div class="form-group">
                    <label>Options:</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="secure" name="secure" value="true">
                            <label for="secure" style="margin: 0;">Secure (HTTPS only)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="httponly" name="httponly" value="true">
                            <label for="httponly" style="margin: 0;">HttpOnly (No JavaScript access)</label>
                        </div>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary">Set Custom Cookie</button>
            </form>
        </div>

        <!-- Current Cookies Display -->
        <div class="card">
            <h2 class="section-title">📊 Current Cookies</h2>

            <div class="cookie-list">
                <?php if (empty($currentCookies)): ?>
                    <div class="cookie-empty">
                        No cookies found. Click a button above to set a cookie.
                    </div>
                <?php else: ?>
                    <?php foreach ($currentCookies as $name => $value): ?>
                        <div class="cookie-item">
                            <div>
                                <div class="cookie-name"><?php echo htmlspecialchars($name); ?></div>
                                <div class="cookie-value"><?php echo htmlspecialchars($value); ?></div>
                            </div>
                            <a href="?action=delete&name=<?php echo urlencode($name); ?>" class="btn btn-danger btn-small">
                                Delete
                            </a>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <!-- JSON Output -->
        <div class="card">
            <h2 class="section-title">💻 JSON Output</h2>
            <div class="json-output">
<?php
$jsonData = [
    'cookies' => $currentCookies,
    'count' => $cookieCount,
    'timestamp' => date('Y-m-d H:i:s'),
    'server' => $_SERVER['SERVER_NAME'] ?? 'localhost',
    'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
];
echo json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
            </div>
        </div>

        <!-- API Endpoints -->
        <div class="card">
            <h2 class="section-title">🔌 API Endpoints</h2>
            <p style="color: #666; margin-bottom: 15px; font-size: 14px;">
                Use these URLs for programmatic testing:
            </p>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px;">
                <div style="margin-bottom: 10px;">
                    <strong>Set Cookie:</strong><br>
                    <code>?action=set&name=cookieName&value=cookieValue</code>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Get Cookies (JSON):</strong><br>
                    <code>?action=json</code>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Clear All Cookies:</strong><br>
                    <code>?action=clear</code>
                </div>
                <div>
                    <strong>Delete Specific Cookie:</strong><br>
                    <code>?action=delete&name=cookieName</code>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
