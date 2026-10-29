package io.github.rokrz.cadernodereceitas;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openShared(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openShared(intent);
    }

    // "Compartilhar → Caderno de Receitas" em outro app: abre /?title=...&text=..., o mesmo
    // formato do share_target do PWA, e o app leva para a tela Salvar link já preenchida.
    private void openShared(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String title = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text == null && title == null) return;

        Uri.Builder url = Uri.parse(getBridge().getLocalUrl()).buildUpon().path("/");
        if (title != null) url.appendQueryParameter("title", title);
        if (text != null) url.appendQueryParameter("text", text);
        String target = url.build().toString();
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(target));

        // Não repetir ao voltar para o app depois.
        intent.setAction(Intent.ACTION_MAIN);
    }
}
