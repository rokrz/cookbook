package io.github.rokrz.cadernodereceitas;

import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/**
 * Login no Google só para o backup no Drive, usando a API de autorização do Google Play Services.
 * Pede apenas o escopo drive.appdata (pasta escondida do app no Drive da pessoa).
 *
 * Não há client ID no código: o Google identifica o app pelo nome do pacote e pela impressão
 * digital SHA-1 da assinatura, cadastrados como cliente OAuth "Android" no Google Cloud Console.
 * Passo a passo em docs/google-drive.md.
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {

    private static final String DRIVE_APPDATA = "https://www.googleapis.com/auth/drive.appdata";

    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pending;

    @Override
    public void load() {
        // Tela do Google para escolher a conta e autorizar o acesso ao Drive.
        consentLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                PluginCall call = pending;
                pending = null;
                if (call == null) return;
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                    call.reject("Login cancelado.", "CANCELED");
                    return;
                }
                try {
                    AuthorizationResult auth = Identity.getAuthorizationClient(getActivity())
                        .getAuthorizationResultFromIntent(result.getData());
                    resolveToken(call, auth);
                } catch (ApiException e) {
                    call.reject(e.getMessage(), String.valueOf(e.getStatusCode()), e);
                }
            }
        );
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA)))
            .build();

        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    // Acesso já autorizado antes: o token vem sem mostrar nada.
                    resolveToken(call, result);
                    return;
                }
                if (!interactive || result.getPendingIntent() == null) {
                    // Precisa da pessoa (escolher conta / autorizar), mas a chamada é em segundo plano.
                    call.resolve(new JSObject());
                    return;
                }
                if (pending != null) pending.reject("Outro login em andamento.", "CANCELED");
                pending = call;
                consentLauncher.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
            })
            .addOnFailureListener(e -> {
                String code = e instanceof ApiException ? String.valueOf(((ApiException) e).getStatusCode()) : "ERROR";
                call.reject(e.getMessage() != null ? e.getMessage() : "Falha no login do Google.", code, e);
            });
    }

    // Remove um token expirado ou revogado do cache do Play Services, para o próximo authorize pegar outro.
    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            call.resolve();
            return;
        }
        new Thread(() -> {
            try {
                GoogleAuthUtil.clearToken(getContext(), token);
            } catch (Exception ignored) {
                // Token desconhecido: nada a limpar.
            }
            call.resolve();
        }).start();
    }

    private void resolveToken(PluginCall call, AuthorizationResult auth) {
        String token = auth.getAccessToken();
        if (token == null) {
            call.reject("O Google não devolveu a autorização.", "NO_TOKEN");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        call.resolve(ret);
    }
}
